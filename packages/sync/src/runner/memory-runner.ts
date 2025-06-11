import PQueue from 'p-queue'
import { ConsecutiveList } from './consecutive-list'
import { EventRunner } from './types'

export type MemoryRunnerOptions = {
  setCursor?: (cursor: number) => Promise<void>
  concurrency?: number
  startCursor?: number
}

// A queue with arbitrarily many partitions, each processing work sequentially.
// Partitions are created lazily and taken out of memory when they go idle.
export class MemoryRunner implements EventRunner {
  consecutive = new ConsecutiveList<number>()
  mainQueue: PQueue
  partitions = new Map<string, PQueue>()
  cursor: number | undefined

  constructor(public opts: MemoryRunnerOptions = {}) {
    this.mainQueue = new PQueue({ concurrency: opts.concurrency ?? Infinity })
    this.cursor = opts.startCursor
  }

  getCursor() {
    return this.cursor
  }

  async addTask(partitionId: string, task: () => Promise<void>) {
    if (this.mainQueue.isPaused) return
    return this.mainQueue.add(() => {
      return this.getPartition(partitionId).add(task)
    })
  }

  private getPartition(partitionId: string) {
    let partition = this.partitions.get(partitionId)
    if (!partition) {
      partition = new PQueue({ concurrency: 1 })
      partition.once('idle', () => this.partitions.delete(partitionId))
      this.partitions.set(partitionId, partition)
    }
    return partition
  }

  async trackEvent(did: string, seq: number, handler: () => Promise<void>) {
    if (this.mainQueue.isPaused) return
    const item = this.consecutive.push(seq)
    await this.addTask(did, async () => {
      await handler()
      const latest = item.complete().at(-1)
      if (latest !== undefined) {
        this.cursor = latest
        if (this.opts.setCursor) {
          await this.opts.setCursor(this.cursor)
        }
      }
    })
  }

  async processAll() {
    await this.mainQueue.onIdle()
  }

  async destroy() {
    this.mainQueue.pause()
    this.mainQueue.clear()
    this.partitions.forEach((p) => p.clear())
    await this.mainQueue.onIdle()
  }
}
