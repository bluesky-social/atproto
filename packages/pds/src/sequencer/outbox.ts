import Sequencer, { RepoEvent, SequencerEmitter } from '.'
import { once } from 'events'
import { EventEmitter } from 'stream'

export class Outbox {
  buffer: RepoEvent[] = []
  caughtUp = false

  constructor(public sequencer: Sequencer, public lastSeen?: number) {}

  // event stream occurs in 3 phases
  // 1. historical events: events that have been added to the DB since the last time a connection was open.
  // The outbox is not yet listening for new events from the sequencer
  // 2. the cutover: the outbox has caught up with where the sequencer purports to be,
  // but the sequencer might already be halfway through sending out a round of updates.
  // Therefore, we start accepting the sequencer's events in a buffer, while making our own request to the
  // database to ensure we're caught up. We then dedupe the query & the buffer & stream the events in order
  // 3. streaming: we're all caught up on historic state, so the sequencer outputs events and we
  // immediately yield them
  async *events(): AsyncIterable<RepoEvent> {
    // catch up as much as we can
    for await (const evt of this.getHistorical()) {
      yield evt
      this.lastSeen = evt.seq
    }

    // make a last request
    for await (const evt of this.streamWithCutover()) {
      yield evt
      this.lastSeen = evt.seq
    }
  }

  // yields only historical events
  async *getHistorical() {
    while (true) {
      const evts = await this.sequencer.requestSeqRange(
        this.lastSeen,
        this.sequencer.lastSeen,
        50,
      )
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

  // streams updates from sequencer, but buffers them as it makes a last request
  // then dedupes them & streams them in order
  async *streamWithCutover(): AsyncIterable<RepoEvent> {
    const internalEmitter = new EventEmitter() as SequencerEmitter

    this.sequencer.on('event', (evt) => {
      if (this.caughtUp) {
        internalEmitter.emit('event', evt)
      } else {
        this.buffer.push(event)
      }
    })

    const cutoverEvts = await this.sequencer.requestSeqRange(this.lastSeen)
    const alreadySent: number[] = []
    for (const evt of cutoverEvts) {
      if (evt !== null) {
        internalEmitter.emit('event', evt)
        alreadySent.push(evt.seq)
      }
    }
    for (const evt of this.buffer) {
      if (!alreadySent.includes(evt.seq)) {
        internalEmitter.emit('event', evt)
      }
    }
    this.caughtUp = true
    this.buffer = []

    // start streaming events
    let event
    while ((event = await once(internalEmitter, 'event'))) {
      yield event
    }
  }
}

export default Outbox
