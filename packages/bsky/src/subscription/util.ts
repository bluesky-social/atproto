import PQueue from 'p-queue'
import { OutputSchema as RepoMessage } from '../lexicon/types/com/atproto/sync/subscribeRepos'
import * as message from '../lexicon/types/com/atproto/sync/subscribeRepos'
import assert from 'node:assert'

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

export class PerfectMap<K, V> extends Map<K, V> {
  get(key: K): V {
    const val = super.get(key)
    assert(val !== undefined, `Key not found in PerfectMap: ${key}`)
    return val
  }
}

// These are the message types that have a sequence number and a repo
export type ProcessableMessage =
  | message.Commit
  | message.Handle
  | message.Migrate
  | message.Tombstone

export function loggableMessage(msg: RepoMessage) {
  if (message.isCommit(msg)) {
    const { seq, rebase, prev, repo, commit, time, tooBig, blobs } = msg
    return {
      $type: msg.$type,
      seq,
      rebase,
      prev: prev?.toString(),
      repo,
      commit: commit.toString(),
      time,
      tooBig,
      hasBlobs: blobs.length > 0,
    }
  } else if (message.isHandle(msg)) {
    return msg
  } else if (message.isMigrate(msg)) {
    return msg
  } else if (message.isTombstone(msg)) {
    return msg
  } else if (message.isInfo(msg)) {
    return msg
  }
  return msg
}

export function jitter(maxMs) {
  return Math.round((Math.random() - 0.5) * maxMs * 2)
}

export function strToInt(str: string) {
  const int = parseInt(str, 10)
  assert(!isNaN(int), 'string could not be parsed to an integer')
  return int
}
