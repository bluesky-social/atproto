import { AsyncBuffer, AsyncBufferFullError } from '@atproto/common'
import { EventEmitter } from 'stream'
import Sequencer, { RepoAppendEvent, SequencerEmitter } from '.'

export type OutboxOpts = {
  maxBufferSize: number
}

export class Outbox {
  internalEmitter = new EventEmitter() as SequencerEmitter

  cutoverBuffer: RepoAppendEvent[] = []
  caughtUp = false
  lastSeen?: number

  outBuffer: AsyncBuffer<RepoAppendEvent>

  constructor(public sequencer: Sequencer, opts: Partial<OutboxOpts> = {}) {
    const { maxBufferSize = 500 } = opts
    this.outBuffer = new AsyncBuffer<RepoAppendEvent>(maxBufferSize)
  }

  // event stream occurs in 3 phases
  // 1. backfill events: events that have been added to the DB since the last time a connection was open.
  // The outbox is not yet listening for new events from the sequencer
  // 2. cutover: the outbox has caught up with where the sequencer purports to be,
  // but the sequencer might already be halfway through sending out a round of updates.
  // Therefore, we start accepting the sequencer's events in a buffer, while making our own request to the
  // database to ensure we're caught up. We then dedupe the query & the buffer & stream the events in order
  // 3. streaming: we're all caught up on historic state, so the sequencer outputs events and we
  // immediately yield them
  async *events(backfillFrom?: string): AsyncGenerator<RepoAppendEvent> {
    // catch up as much as we can
    if (backfillFrom) {
      for await (const evt of this.getBackfill(backfillFrom)) {
        yield evt
        this.lastSeen = evt.seq
      }
    } else {
      this.caughtUp = true
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

    // only need to perform cutover if we've been backfilling
    if (backfillFrom) {
      const cutoverEvts = await this.sequencer.requestSeqRange({
        earliestSeq: this.lastSeen,
      })
      const toSend = cutoverEvts.filter(
        (e) => this.sequencer.lastSeen && e.seq < this.sequencer.lastSeen,
      )
      const alreadySent: number[] = []
      for (const evt of toSend) {
        this.outBuffer.push(evt)
        this.lastSeen = evt.seq
        alreadySent.push(evt.seq)
      }
      for (const evt of this.cutoverBuffer) {
        if (!alreadySent.includes(evt.seq)) {
          this.outBuffer.push(evt)
          this.lastSeen = evt.seq
        }
      }
      this.caughtUp = true
      this.cutoverBuffer = []
    } else {
      this.caughtUp = true
    }

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
  async *getBackfill(startTime?: string) {
    while (true) {
      const evts = await this.sequencer.requestSeqRange({
        earliestTime: startTime,
        earliestSeq: this.lastSeen,
        latestSeq: this.sequencer.lastSeen,
        limit: 50,
      })
      for (const evt of evts) {
        yield evt
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
