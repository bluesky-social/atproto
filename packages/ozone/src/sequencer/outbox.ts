import { AsyncBuffer } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { LabelsEvt, Sequencer } from './sequencer.js'

export type OutboxOpts = {
  maxBufferSize: number
  onOverflow?: () => void
}

export class Outbox {
  private caughtUp = false
  private readonly maxBufferSize: number
  lastSeen = -1

  cutoverBuffer: LabelsEvt[]
  outBuffer: AsyncBuffer<LabelsEvt>

  constructor(
    public sequencer: Sequencer,
    private readonly opts: Partial<OutboxOpts> = {},
  ) {
    const { maxBufferSize = 500 } = opts
    this.maxBufferSize = maxBufferSize
    this.cutoverBuffer = []
    this.outBuffer = new AsyncBuffer<LabelsEvt>(maxBufferSize)
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
    signal?: AbortSignal,
  ): AsyncGenerator<LabelsEvt> {
    if (signal?.aborted || this.sequencer.destroyed) return
    let stopped = false
    const stop = (err?: unknown) => {
      if (stopped) return
      stopped = true
      this.sequencer.off('events', addToBuffer)
      this.sequencer.off('close', onClose)
      signal?.removeEventListener('abort', onClose)
      this.cutoverBuffer = []
      this.outBuffer.curr.length = 0
      if (err !== undefined) {
        this.outBuffer.throw(err)
      } else {
        this.outBuffer.close()
      }
    }
    const onClose = () => stop()
    const overflow = () => {
      stop(
        new InvalidRequestError('Stream consumer too slow', 'ConsumerTooSlow'),
      )
      // @NOTE The consumer may be suspended in a socket write, so it cannot
      // deliver the error or release this connection itself.
      this.opts.onOverflow?.()
    }
    const addToBuffer = (evts: LabelsEvt[]) => {
      if (stopped) return
      const size = this.caughtUp
        ? this.outBuffer.size
        : this.cutoverBuffer.length
      if (size + evts.length > this.maxBufferSize) {
        overflow()
      } else if (this.caughtUp) {
        this.outBuffer.pushMany(evts)
      } else {
        this.cutoverBuffer.push(...evts)
      }
    }

    const cutover = async () => {
      if (backfillCursor !== undefined) {
        const cutoverEvts = await this.sequencer.requestLabelRange({
          earliestId: this.lastSeen > -1 ? this.lastSeen : backfillCursor,
          limit: this.maxBufferSize + 1,
        })
        if (stopped) return
        const last = cutoverEvts.at(-1)?.seq ?? this.lastSeen
        const buffered = this.cutoverBuffer.filter((evt) => evt.seq > last)
        this.caughtUp = true
        this.cutoverBuffer = []
        addToBuffer([...cutoverEvts, ...buffered])
      }
    }

    signal?.addEventListener('abort', onClose, { once: true })
    this.sequencer.once('close', onClose)
    try {
      if (backfillCursor !== undefined) {
        for await (const evt of this.getBackfill(backfillCursor)) {
          if (stopped) return
          this.lastSeen = evt.seq
          yield evt
          if (stopped) return
        }
      } else {
        this.caughtUp = true
      }
      if (stopped || this.sequencer.destroyed) return
      this.sequencer.on('events', addToBuffer)
      void cutover().catch(stop)

      for await (const evt of this.outBuffer.events()) {
        if (evt.seq > this.lastSeen) {
          this.lastSeen = evt.seq
          yield evt
        }
      }
    } finally {
      stop()
    }
  }

  // yields only historical events
  async *getBackfill(backfillCursor: number) {
    const PAGE_SIZE = 500
    while (true) {
      const evts = await this.sequencer.requestLabelRange({
        earliestId: this.lastSeen > -1 ? this.lastSeen : backfillCursor,
        limit: PAGE_SIZE,
      })
      for (const evt of evts) {
        yield evt
      }
      // if we're within half a pagesize of the sequencer, we call it good & switch to cutover
      const seqCursor = this.sequencer.lastSeen ?? -1
      if (seqCursor - this.lastSeen < PAGE_SIZE / 2) break
      if (evts.length < 1) break
    }
  }
}
