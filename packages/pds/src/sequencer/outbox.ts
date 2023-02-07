import Sequencer, { RepoEvent, SequencerEmitter } from '.'
import { EventEmitter } from 'stream'
import { AsyncBuffer, AsyncBufferFullError } from '@atproto/common'

export type OutboxOpts = {
  maxBufferSize: number
}

export class Outbox {
  internalEmitter = new EventEmitter() as SequencerEmitter

  cutoverBuffer: RepoEvent[] = []
  caughtUp = false
  lastSeen?: number

  outBuffer: AsyncBuffer<RepoEvent>

  constructor(public sequencer: Sequencer, opts: Partial<OutboxOpts> = {}) {
    const { maxBufferSize = 500 } = opts
    this.outBuffer = new AsyncBuffer<RepoEvent>(maxBufferSize)
  }

  // event stream occurs in 3 phases
  // 1. historical events: events that have been added to the DB since the last time a connection was open.
  // The outbox is not yet listening for new events from the sequencer
  // 2. the cutover: the outbox has caught up with where the sequencer purports to be,
  // but the sequencer might already be halfway through sending out a round of updates.
  // Therefore, we start accepting the sequencer's events in a buffer, while making our own request to the
  // database to ensure we're caught up. We then dedupe the query & the buffer & stream the events in order
  // 3. streaming: we're all caught up on historic state, so the sequencer outputs events and we
  // immediately yield them
  async *events(startTime?: string): AsyncGenerator<RepoEvent> {
    // catch up as much as we can
    for await (const evt of this.getHistorical(startTime)) {
      yield evt
      this.lastSeen = evt.seq
    }

    // streams updates from sequencer, but buffers them as it makes a last request
    // then dedupes them & streams out them in order
    this.sequencer.on('event', (evt) => {
      if (this.caughtUp) {
        this.outBuffer.push(evt)
      } else {
        this.cutoverBuffer.push(evt)
      }
    })

    const cutoverEvts = await this.sequencer.requestSeqRange({
      earliestSeq: this.lastSeen,
    })
    const alreadySent: number[] = []
    for (const evt of cutoverEvts) {
      if (evt !== null) {
        yield evt
        this.lastSeen = evt.seq
        alreadySent.push(evt.seq)
      }
    }
    for (const evt of this.cutoverBuffer) {
      if (!alreadySent.includes(evt.seq)) {
        yield evt
        this.lastSeen = evt.seq
      }
    }
    this.caughtUp = true
    this.cutoverBuffer = []
    while (true) {
      try {
        const evt = await this.outBuffer.nextEvent()
        yield evt
      } catch (err) {
        if (err instanceof AsyncBufferFullError) {
          throw new StreamConsumerTooSlowError(err)
        } else {
          throw err
        }
      }
    }
  }

  // yields only historical events
  async *getHistorical(startTime?: string) {
    while (true) {
      const evts = await this.sequencer.requestSeqRange({
        earliestTime: startTime,
        earliestSeq: this.lastSeen,
        limit: 50,
      })
      for (const evt of evts) {
        if (evt !== null) {
          yield evt
        }
      }
      if (evts.length < 50) {
        break
      }
    }
  }
}

export class StreamConsumerTooSlowError extends Error {
  constructor(bufferErr: AsyncBufferFullError) {
    super(`Stream consumer too slow: ${bufferErr.message}`)
  }
}

export default Outbox
