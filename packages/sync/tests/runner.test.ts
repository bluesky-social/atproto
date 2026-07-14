import { wait } from '@atproto/common'
import { ConsecutiveList, MemoryRunner } from '../src/index.js'

describe('EventRunner utils', () => {
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

  describe('MemoryRunner', () => {
    it('performs work in parallel across partitions, serial within a partition.', async () => {
      const runner = new MemoryRunner({ concurrency: Infinity })
      const complete: {
        1: number[]
        2: number[]
      } = {
        1: [],
        2: [],
      }
      // partition 1 items start slow but get faster: slow should still complete first.
      runner.addTask('1', async () => {
        await wait(30)
        complete[1].push(1)
      })
      runner.addTask('1', async () => {
        await wait(20)
        complete[1].push(2)
      })
      runner.addTask('1', async () => {
        complete[1].push(3)
      })
      expect(runner.partitionCount).toEqual(1)
      // partition 2 items complete quickly except the last, which is slowest of all events.
      runner.addTask('2', async () => {
        await wait(1)
        complete[2].push(1)
      })
      runner.addTask('2', async () => {
        await wait(1)
        complete[2].push(2)
      })
      runner.addTask('2', async () => {
        complete[2].push(3)
      })
      runner.addTask('2', async () => {
        await wait(60)
        complete[2].push(4)
      })
      expect(runner.partitionCount).toEqual(2)
      await runner.processAll()
      expect(complete).toEqual({
        1: [1, 2, 3],
        2: [1, 2, 3, 4],
      })
      expect(runner.partitionCount).toEqual(0)
    })

    it('limits overall concurrency.', async () => {
      const runner = new MemoryRunner({ concurrency: 1 })
      const complete: number[] = []
      // if concurrency were not constrained, partition 1 would complete all items
      // before any items from partition 2. since it is constrained, the work is complete in the order added.
      runner.addTask('1', async () => {
        await wait(1)
        complete.push(11)
      })
      runner.addTask('2', async () => {
        await wait(10)
        complete.push(21)
      })
      runner.addTask('1', async () => {
        await wait(1)
        complete.push(12)
      })
      runner.addTask('2', async () => {
        await wait(10)
        complete.push(22)
      })
      // only partition 1 exists so far due to the concurrency
      expect(runner.partitionCount).toEqual(1)
      await runner.processAll()
      expect(complete).toEqual([11, 21, 12, 22])
      expect(runner.partitionCount).toEqual(0)
    })

    it('settles with many items.', async () => {
      const runner = new MemoryRunner({ concurrency: 100 })
      const complete: { partition: string; id: number }[] = []
      const partitions = new Set<string>()
      for (let i = 0; i < 500; ++i) {
        const partition = Math.floor(Math.random() * 16).toString(10)
        partitions.add(partition)
        runner.addTask(partition, async () => {
          await wait((i % 2) * 2)
          complete.push({ partition, id: i })
        })
      }
      expect(runner.partitionCount).toBeLessThanOrEqual(partitions.size)
      await runner.processAll()
      expect(complete.length).toEqual(500)
      for (const partition of partitions) {
        const ids = complete
          .filter((item) => item.partition === partition)
          .map((item) => item.id)
        expect(ids).toEqual([...ids].sort((a, b) => a - b))
      }
      expect(runner.partitionCount).toEqual(0)
    })
  })
})
