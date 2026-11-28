import { describe, expect, it } from 'vitest'
import { ConsecutiveList } from './consecutive-list.js'

describe(ConsecutiveList, () => {
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
