import Sequencer, { RepoEvent, SequencerEmitter } from '.'
import { EventEmitter } from 'stream'

export class Outbox {
  internalEmitter = new EventEmitter() as SequencerEmitter

  cutoverBuffer: RepoEvent[] = []
  caughtUp = false
  lastSeen?: number

  outBuffer = new OutBuffer()

  constructor(public sequencer: Sequencer) {}

  // event stream occurs in 3 phases
  // 1. historical events: events that have been added to the DB since the last time a connection was open.
  // The outbox is not yet listening for new events from the sequencer
  // 2. the cutover: the outbox has caught up with where the sequencer purports to be,
  // but the sequencer might already be halfway through sending out a round of updates.
  // Therefore, we start accepting the sequencer's events in a buffer, while making our own request to the
  // database to ensure we're caught up. We then dedupe the query & the buffer & stream the events in order
  // 3. streaming: we're all caught up on historic state, so the sequencer outputs events and we
  // immediately yield them
  async *events(from?: number): AsyncGenerator<RepoEvent> {
    this.lastSeen = from

    // catch up as much as we can
    for await (const evt of this.getHistorical()) {
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
      firstExclusive: this.lastSeen,
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
      const evt = await this.outBuffer.nextEvent()
      yield evt
    }
  }

  // yields only historical events
  async *getHistorical() {
    while (true) {
      const evts = await this.sequencer.requestSeqRange({
        firstExclusive: this.lastSeen,
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

class OutBuffer {
  private events: RepoEvent[] = []
  private promise: Promise<void>
  private resolve: () => void

  constructor() {
    this.resetPromise()
  }

  get curr(): RepoEvent[] {
    return this.events
  }

  resetPromise() {
    this.promise = new Promise<void>((r) => (this.resolve = r))
  }

  push(evt: RepoEvent) {
    this.events.push(evt)
    this.resolve()
    this.resetPromise()
  }

  async nextEvent(): Promise<RepoEvent> {
    const [first, ...rest] = this.events
    if (first) {
      this.events = rest
      return first
    } else {
      await this.promise
      return this.nextEvent()
    }
  }
}

export default Outbox
