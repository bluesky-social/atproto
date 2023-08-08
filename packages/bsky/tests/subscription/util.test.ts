import { wait } from '@atproto/common'
import {
  ConsecutiveList,
  LatestQueue,
  PartitionedQueue,
} from '../../src/subscription/util'
import { randomStr } from '../../../crypto/src'

describe('subscription utils', () => {
  describe('ConsecutiveList', () => {
    it('tracks consecutive complete items.', () => {
      const consecutive = new ConsecutiveList<number>()
      // add items
      const item1 = consecutive.push(1)
      const item2 = consecutive.push(2)
      const item3 = consecutive.push(3)
      expect(item1.isComplete).toEqual(false)
      expect(item2.isComplete).toEqual(false)
      expect(item3.isComplete).toEqual(false)
      // complete items out of order
      expect(consecutive.list.length).toBe(3)
      expect(item2.complete()).toEqual([])
      expect(item2.isComplete).toEqual(true)
      expect(consecutive.list.length).toBe(3)
      expect(item1.complete()).toEqual([1, 2])
      expect(item1.isComplete).toEqual(true)
      expect(consecutive.list.length).toBe(1)
      expect(item3.complete()).toEqual([3])
      expect(consecutive.list.length).toBe(0)
      expect(item3.isComplete).toEqual(true)
    })
  })

  describe('LatestQueue', () => {
    it('only performs most recently queued item.', async () => {
      const latest = new LatestQueue()
      const complete: number[] = []
      latest.add(async () => {
        await wait(1)
        complete.push(1)
      })
      latest.add(async () => {
        await wait(1)
        complete.push(2)
      })
      latest.add(async () => {
        await wait(1)
        complete.push(3)
      })
      latest.add(async () => {
        await wait(1)
        complete.push(4)
      })
      await latest.queue.onIdle()
      expect(complete).toEqual([1, 4]) // skip 2, 3
      latest.add(async () => {
        await wait(1)
        complete.push(5)
      })
      latest.add(async () => {
        await wait(1)
        complete.push(6)
      })
      await latest.queue.onIdle()
      expect(complete).toEqual([1, 4, 5, 6])
    })

    it('stops processing queued messages on destroy.', async () => {
      const latest = new LatestQueue()
      const complete: number[] = []
      latest.add(async () => {
        await wait(1)
        complete.push(1)
      })
      latest.add(async () => {
        await wait(1)
        complete.push(2)
      })
      const destroyed = latest.destroy()
      latest.add(async () => {
        await wait(1)
        complete.push(3)
      })
      await destroyed
      expect(complete).toEqual([1]) // 2 was cleared, 3 was after destroy
      // show that waiting on destroyed above was already enough to reflect all complete items
      await latest.queue.onIdle()
      expect(complete).toEqual([1])
    })
  })

  describe('PartitionedQueue', () => {
    it('performs work in parallel across partitions, serial within a partition.', async () => {
      const partitioned = new PartitionedQueue({ concurrency: Infinity })
      const complete: number[] = []
      // partition 1 items start slow but get faster: slow should still complete first.
      partitioned.add('1', async () => {
        await wait(30)
        complete.push(11)
      })
      partitioned.add('1', async () => {
        await wait(20)
        complete.push(12)
      })
      partitioned.add('1', async () => {
        await wait(1)
        complete.push(13)
      })
      expect(partitioned.partitions.size).toEqual(1)
      // partition 2 items complete quickly except the last, which is slowest of all events.
      partitioned.add('2', async () => {
        await wait(1)
        complete.push(21)
      })
      partitioned.add('2', async () => {
        await wait(1)
        complete.push(22)
      })
      partitioned.add('2', async () => {
        await wait(1)
        complete.push(23)
      })
      partitioned.add('2', async () => {
        await wait(60)
        complete.push(24)
      })
      expect(partitioned.partitions.size).toEqual(2)
      await partitioned.main.onIdle()
      expect(complete).toEqual([21, 22, 23, 11, 12, 13, 24])
      expect(partitioned.partitions.size).toEqual(0)
    })

    it('limits overall concurrency.', async () => {
      const partitioned = new PartitionedQueue({ concurrency: 1 })
      const complete: number[] = []
      // if concurrency were not constrained, partition 1 would complete all items
      // before any items from partition 2. since it is constrained, the work is complete in the order added.
      partitioned.add('1', async () => {
        await wait(1)
        complete.push(11)
      })
      partitioned.add('2', async () => {
        await wait(10)
        complete.push(21)
      })
      partitioned.add('1', async () => {
        await wait(1)
        complete.push(12)
      })
      partitioned.add('2', async () => {
        await wait(10)
        complete.push(22)
      })
      // only partition 1 exists so far due to the concurrency
      expect(partitioned.partitions.size).toEqual(1)
      await partitioned.main.onIdle()
      expect(complete).toEqual([11, 21, 12, 22])
      expect(partitioned.partitions.size).toEqual(0)
    })

    it('settles with many items.', async () => {
      const partitioned = new PartitionedQueue({ concurrency: 100 })
      const complete: { partition: string; id: number }[] = []
      const partitions = new Set<string>()
      for (let i = 0; i < 500; ++i) {
        const partition = randomStr(1, 'base16').slice(0, 1)
        partitions.add(partition)
        partitioned.add(partition, async () => {
          await wait((i % 2) * 2)
          complete.push({ partition, id: i })
        })
      }
      expect(partitioned.partitions.size).toEqual(partitions.size)
      await partitioned.main.onIdle()
      expect(complete.length).toEqual(500)
      for (const partition of partitions) {
        const ids = complete
          .filter((item) => item.partition === partition)
          .map((item) => item.id)
        expect(ids).toEqual([...ids].sort((a, b) => a - b))
      }
      expect(partitioned.partitions.size).toEqual(0)
    })
  })
})
