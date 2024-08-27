import { Event } from '../events'
import { ConsecutiveList } from './consecutive-list'
import { PartitionedQueue } from './partitioned'

export type SyncQueueOptions = {
  handleEvt: (evt: Event) => Promise<void>
  getCursor?: () => Promise<number | undefined>
  setCursor?: (cursor: number) => Promise<void>
}

export class SyncQueue {
  consecutive = new ConsecutiveList<number>()
  repoQueue = new PartitionedQueue({ concurrency: Infinity })

  constructor(public handleEvt: (evt: Event) => Promise<void>) {}

  async addEvent(evt: Event) {
    const item = this.consecutive.push(evt.seq)
    await this.repoQueue.add(evt.did, () => this.handleEvt(evt))
    const latest = item.complete().at(-1)
    // @TODO something with latest
    console.log(latest)
  }
}
