import PQueue from 'p-queue'

// A queue with arbitrarily many partitions, each processing work sequentially.
// Partitions are created lazily and taken out of memory when they go idle.
export class PartitionedQueue {
  main = new PQueue({ concurrency: Infinity })
  partitions = new Map<string, PQueue>()

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

export class LatestQueue {
  queue = new PQueue({ concurrency: 1 })

  async add(task: () => Promise<void>) {
    if (this.queue.isPaused) return
    this.queue.clear() // Only queue the latest task, invalidate any previous ones
    return this.queue.add(task)
  }

  async destroy() {
    this.queue.pause()
    this.queue.clear()
    await this.queue.onIdle() // All in-flight work completes
  }
}

/**
 * Add items to a list, and mark those items as
 * completed. Upon item completion, get list of consecutive
 * items completed at the head of the list. Example:
 *
 * const consecutive = new ConsecutiveList<number>()
 * const item1 = consecutive.push(1)
 * const item2 = consecutive.push(2)
 * const item3 = consecutive.push(3)
 * item2.complete() // []
 * item1.complete() // [1, 2]
 * item3.complete() // [3]
 *
 */
export class ConsecutiveList<T> {
  list: ConsecutiveItem<T>[] = []

  push(value: T) {
    const item = new ConsecutiveItem<T>(this, value)
    this.list.push(item)
    return item
  }

  complete(): T[] {
    let i = 0
    while (this.list[i]?.isComplete) {
      i += 1
    }
    return this.list.splice(0, i).map((item) => item.value)
  }
}

export class ConsecutiveItem<T> {
  isComplete = false
  constructor(private consecutive: ConsecutiveList<T>, public value: T) {}

  complete() {
    this.isComplete = true
    return this.consecutive.complete()
  }
}
