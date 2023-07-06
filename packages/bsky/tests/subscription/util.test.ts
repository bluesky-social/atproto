import { ConsecutiveList } from '../../src/subscription/util'

describe('subscription utils', () => {
  it('consecutive list', () => {
    const consecutive = new ConsecutiveList<number>()
    const item1 = consecutive.push(1)
    const item2 = consecutive.push(2)
    const item3 = consecutive.push(3)
    expect(consecutive.list.length).toBe(3)
    expect(item2.complete()).toEqual([])
    expect(consecutive.list.length).toBe(3)
    expect(item1.complete()).toEqual([1, 2])
    expect(consecutive.list.length).toBe(1)
    expect(item3.complete()).toEqual([3])
    expect(consecutive.list.length).toBe(0)
  })
})
