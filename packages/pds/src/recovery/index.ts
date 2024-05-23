import AppContext from '../context'
import PQueue from 'p-queue'
import { CommitEvt, TombstoneEvt, SeqEvt } from '../sequencer'

export class Recoverer {
  cursor = 0
  queues = new Map<string, PQueue>()

  constructor(public ctx: AppContext) {}

  async run() {
    const page = await this.ctx.sequencer.requestSeqRange({
      earliestSeq: this.cursor,
      limit: 5000,
    })
  }

  async processEvent(evt: SeqEvt) {
    // only need to process commits & tombstones
    if (evt.type === 'tombstone') {
      await this.processTombstone(evt.evt)
      evt.evt
    }
    if (evt.type === 'commit') {
      await this.processCommit(evt.evt)
    }
  }

  async processCommit(evt: CommitEvt) {}

  async processTombstone(evt: TombstoneEvt) {}
}
