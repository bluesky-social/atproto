import PQueue from 'p-queue'

// A queue with arbitrarily many partitions, each processing work sequentially.
// Partitions are created lazily and taken out of memory when they go idle.
export class PartitionedQueue {
  main: PQueue
  partitions = new Map<string, PQueue>()

  constructor(opts: { concurrency: number }) {
    this.main = new PQueue({ concurrency: opts.concurrency })
  }

  async add(partitionId: string, task: () => Promise<void>) {
    if (this.main.isPaused) return
    return this.main.add(() => {
      return this.getPartition(partitionId).add(task)
    })
  }

  async destroy() {
    this.main.pause()
    this.main.clear()
    this.partitions.forEach((p) => p.clear())
    await this.main.onIdle() // All in-flight work completes
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
}
