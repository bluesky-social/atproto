import { AsyncBuffer, AsyncBufferFullError } from '@atproto/common'
import Sequencer, { RepoAppendEvent } from '.'

export type OutboxOpts = {
  maxBufferSize: number
}

export class Outbox {
  caughtUp = false
  lastSeen = -1

  cutoverBuffer: RepoAppendEvent[]
  outBuffer: AsyncBuffer<RepoAppendEvent>

  constructor(public sequencer: Sequencer, opts: Partial<OutboxOpts> = {}) {
    const { maxBufferSize = 500 } = opts
    this.cutoverBuffer = []
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
  async *events(
    backfillCursor?: number,
    backFillTime?: string,
  ): AsyncGenerator<RepoAppendEvent> {
    // catch up as much as we can
    if (backfillCursor) {
      for await (const evt of this.getBackfill(backfillCursor, backFillTime)) {
        this.lastSeen = evt.seq
        yield evt
      }
    } else {
      // if not backfill, we don't need to cutover, just start streaming
      this.caughtUp = true
    }

    // streams updates from sequencer, but buffers them for cutover as it makes a last request
    this.sequencer.on('events', (evts) => {
      if (this.caughtUp) {
        this.outBuffer.pushMany(evts)
      } else {
        this.cutoverBuffer = [...this.cutoverBuffer, ...evts]
      }
    })

    const cutover = async () => {
      // only need to perform cutover if we've been backfilling
      if (backfillCursor) {
        const cutoverEvts = await this.sequencer.requestSeqRange({
          earliestSeq: this.lastSeen > -1 ? this.lastSeen : backfillCursor,
          earliestTime: backFillTime,
        })
        this.outBuffer.pushMany(cutoverEvts)
        // dont worry about dupes, we ensure order on yield
        this.outBuffer.pushMany(this.cutoverBuffer)
        this.caughtUp = true
        this.cutoverBuffer = []
      } else {
        this.caughtUp = true
      }
    }
    cutover()

    while (true) {
      try {
        for await (const evt of this.outBuffer.events()) {
          if (evt.seq > this.lastSeen) {
            this.lastSeen = evt.seq
            yield evt
          }
        }
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
  async *getBackfill(backfillCursor: number, backfillTime?: string) {
    while (true) {
      const evts = await this.sequencer.requestSeqRange({
        earliestTime: backfillTime,
        earliestSeq: this.lastSeen > -1 ? this.lastSeen : backfillCursor,
        limit: 50,
      })
      for (const evt of evts) {
        yield evt
      }
      // we requested 50, if we get less than that then we know we're caught up & can do cutover
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
