import { describe, expect, it } from 'vitest'
import { arrayAgg } from './array-agg.js'

describe('arrayAgg', () => {
  it('aggregates items based on comparison and aggregation functions', () => {
    const input = [1, 1, 2, 2, 3, 3, 3]
    const result = arrayAgg(
      input,
      (a, b) => a === b,
      (items) => ({ value: items[0], count: items.length }),
    )
    expect(result).toEqual([
      { value: 1, count: 2 },
      { value: 2, count: 2 },
      { value: 3, count: 3 },
    ])
  })

  it('returns an empty array when input is empty', () => {
    const input: number[] = []
    const result = arrayAgg(
      input,
      (a, b) => a === b,
      (items) => ({ value: items[0], count: items.length }),
    )
    expect(result).toEqual([])
  })

  it('handles non-consecutive grouping', () => {
    const input = [1, 2, 1, 2, 3, 1]
    const result = arrayAgg(
      input,
      (a, b) => a === b,
      (items) => ({ value: items[0], count: items.length }),
    )
    expect(result).toEqual([
      { value: 1, count: 3 },
      { value: 2, count: 2 },
      { value: 3, count: 1 },
    ])
  })
})
