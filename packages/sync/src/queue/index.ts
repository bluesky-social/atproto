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
  cursor = 0

  constructor(public opts: SyncQueueOptions) {}

  async addEvent(evt: Event) {
    const item = this.consecutive.push(evt.seq)
    await this.repoQueue.add(evt.did, () => this.opts.handleEvt(evt))
    const latest = item.complete().at(-1)
    if (latest !== undefined) {
      this.cursor = latest
    }
  }

  async processAll() {
    await this.repoQueue.main.onIdle()
  }

  async destroy() {
    await this.repoQueue.destroy()
  }
}
