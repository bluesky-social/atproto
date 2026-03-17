import { Timestamp } from '@bufbuild/protobuf'
import {
  HydrationMap,
  mergeManyMaps,
  mergeMaps,
  mergeNestedMaps,
  parseDate,
} from '../../src/hydration/util'

const mapToObj = (map: HydrationMap<any>) => {
  const obj: Record<string, any> = {}
  for (const [key, value] of map) {
    obj[key] = value
  }
  return obj
}

describe('hydration util', () => {
  it(`mergeMaps: merges two maps`, () => {
    const compare = new HydrationMap<string>()
    compare.set('a', 'a')
    compare.set('b', 'b')

    const a = new HydrationMap<string>().set('a', 'a')
    const b = new HydrationMap<string>().set('b', 'b')
    const merged = mergeMaps(a, b)

    expect(mapToObj(merged!)).toEqual(mapToObj(compare))
  })

  it(`mergeManyMaps: merges three maps`, () => {
    const compare = new HydrationMap<string>()
    compare.set('a', 'a')
    compare.set('b', 'b')
    compare.set('c', 'c')

    const a = new HydrationMap<string>().set('a', 'a')
    const b = new HydrationMap<string>().set('b', 'b')
    const c = new HydrationMap<string>().set('c', 'c')
    const merged = mergeManyMaps(a, b, c)

    expect(mapToObj(merged!)).toEqual(mapToObj(compare))
  })

  it(`mergeNestedMaps: merges two nested maps`, () => {
    const compare = new HydrationMap<HydrationMap<string>>()
    const compareA = new HydrationMap<string>().set('a', 'a')
    const compareB = new HydrationMap<string>().set('b', 'b')
    compare.set('a', compareA)
    compare.set('b', compareB)

    const a = new HydrationMap<HydrationMap<string>>().set(
      'a',
      new HydrationMap<string>().set('a', 'a'),
    )
    const b = new HydrationMap<HydrationMap<string>>().set(
      'b',
      new HydrationMap<string>().set('b', 'b'),
    )
    const merged = mergeNestedMaps(a, b)

    expect(mapToObj(merged!)).toEqual(mapToObj(compare))
  })

  it(`mergeNestedMaps: merges two nested maps with common keys`, () => {
    const compare = new HydrationMap<HydrationMap<boolean>>()
    const compareA = new HydrationMap<boolean>()
    compareA.set('b', true)
    compareA.set('c', true)
    compare.set('a', compareA)

    const a = new HydrationMap<HydrationMap<boolean>>().set(
      'a',
      new HydrationMap<boolean>().set('b', true),
    )
    const b = new HydrationMap<HydrationMap<boolean>>().set(
      'a',
      new HydrationMap<boolean>().set('c', true),
    )
    const merged = mergeNestedMaps(a, b)

    expect(mapToObj(merged!)).toEqual(mapToObj(compare))
  })

  describe('parseDate', () => {
    it('returns undefined for undefined input', () => {
      expect(parseDate(undefined)).toBeUndefined()
    })

    it('returns undefined for Go zero-value date (year 0001)', () => {
      // Go zero-value for time.Time is 0001-01-01 00:00:00 UTC
      // which is -62135596800000ms from epoch
      const goZeroDate = new Date(-62135596800000)
      const goZeroTimestamp = Timestamp.fromDate(goZeroDate)
      expect(parseDate(goZeroTimestamp)).toBeUndefined()
    })

    it('returns the date for valid dates', () => {
      const validDate = new Date('2024-01-01T00:00:00Z')
      const validTimestamp = Timestamp.fromDate(validDate)
      expect(parseDate(validTimestamp)).toEqual(validDate)
    })

    it('returns the date for dates close to but not equal to Go zero-value', () => {
      const nearZeroDate = new Date(-62135596800000 + 1000) // 1 second after
      const nearZeroTimestamp = Timestamp.fromDate(nearZeroDate)
      expect(parseDate(nearZeroTimestamp)).toEqual(nearZeroDate)
    })

    it('returns the date for epoch (1970-01-01)', () => {
      const epochDate = new Date(0)
      const epochTimestamp = Timestamp.fromDate(epochDate)
      expect(parseDate(epochTimestamp)).toEqual(epochDate)
    })

    it('returns the date for recent dates', () => {
      const recentDate = new Date('2026-03-17T00:00:00Z')
      const recentTimestamp = Timestamp.fromDate(recentDate)
      expect(parseDate(recentTimestamp)).toEqual(recentDate)
    })
  })
})
