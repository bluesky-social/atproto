import { describe, expect, it } from 'vitest'
import { getNextRawLimit } from './getGroupedNotifications.js'

describe('adaptive raw notification fetch limit', () => {
  it.each([
    {
      description: 'estimates from the observed notification-to-group ratio',
      itemsFetched: 1200,
      groupsBuilt: 18,
      groupsNeeded: 30,
      expected: 800,
    },
    {
      description: 'caps the estimate at the remaining item budget',
      itemsFetched: 1200,
      groupsBuilt: 6,
      groupsNeeded: 30,
      expected: 1800,
    },
    {
      description: 'estimates additional items for a partially filled page',
      itemsFetched: 300,
      groupsBuilt: 10,
      groupsNeeded: 30,
      expected: 600,
    },
    {
      description: 'fetches a minimum batch when no groups were built',
      itemsFetched: 300,
      groupsBuilt: 0,
      groupsNeeded: 30,
      expected: 300,
    },
    {
      description: 'keeps the minimum batch when only one group is missing',
      itemsFetched: 1200,
      groupsBuilt: 29,
      groupsNeeded: 30,
      expected: 300,
    },
    {
      description: 'fetches more items when enough groups were built',
      itemsFetched: 1200,
      groupsBuilt: 30,
      groupsNeeded: 30,
      expected: 300,
    },
    {
      description: 'caps the minimum batch at the remaining item budget',
      itemsFetched: 2900,
      groupsBuilt: 18,
      groupsNeeded: 30,
      expected: 100,
    },
    {
      description: 'returns zero when the item budget is exhausted',
      itemsFetched: 3000,
      groupsBuilt: 10,
      groupsNeeded: 30,
      expected: 0,
    },
  ])(
    '$description',
    ({ itemsFetched, groupsBuilt, groupsNeeded, expected }) => {
      expect(
        getNextRawLimit(itemsFetched, groupsBuilt, groupsNeeded, 300, 3000),
      ).toBe(expected)
    },
  )
})
