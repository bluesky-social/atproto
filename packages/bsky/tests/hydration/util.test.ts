import {
  HydrationMap,
  mergeManyMaps,
  mergeMaps,
  mergeNestedMaps,
} from '../../src/hydration/util'

const mapToObj = (map: HydrationMap<string, unknown>) => {
  return Object.fromEntries(map) as Record<string, unknown>
}

describe('hydration util', () => {
  it(`mergeMaps: merges two maps`, () => {
    const compare = new HydrationMap<string, string>()
    compare.set('a', 'a')
    compare.set('b', 'b')

    const a = new HydrationMap<string, string>().set('a', 'a')
    const b = new HydrationMap<string, string>().set('b', 'b')
    const merged = mergeMaps(a, b)

    expect(mapToObj(merged!)).toEqual(mapToObj(compare))
  })

  it(`mergeManyMaps: merges three maps`, () => {
    const compare = new HydrationMap<string, string>()
    compare.set('a', 'a')
    compare.set('b', 'b')
    compare.set('c', 'c')

    const a = new HydrationMap<string, string>().set('a', 'a')
    const b = new HydrationMap<string, string>().set('b', 'b')
    const c = new HydrationMap<string, string>().set('c', 'c')
    const merged = mergeManyMaps(a, b, c)

    expect(mapToObj(merged!)).toEqual(mapToObj(compare))
  })

  it(`mergeNestedMaps: merges two nested maps`, () => {
    const compare = new HydrationMap<string, HydrationMap<string, string>>()
    const compareA = new HydrationMap<string, string>().set('a', 'a')
    const compareB = new HydrationMap<string, string>().set('b', 'b')
    compare.set('a', compareA)
    compare.set('b', compareB)

    const a = new HydrationMap<string, HydrationMap<string, string>>().set(
      'a',
      new HydrationMap<string, string>().set('a', 'a'),
    )
    const b = new HydrationMap<string, HydrationMap<string, string>>().set(
      'b',
      new HydrationMap<string, string>().set('b', 'b'),
    )
    const merged = mergeNestedMaps(a, b)

    expect(mapToObj(merged!)).toEqual(mapToObj(compare))
  })

  it(`mergeNestedMaps: merges two nested maps with common keys`, () => {
    const compare = new HydrationMap<string, HydrationMap<string, boolean>>()
    const compareA = new HydrationMap<string, boolean>()
    compareA.set('b', true)
    compareA.set('c', true)
    compare.set('a', compareA)

    const a = new HydrationMap<string, HydrationMap<string, boolean>>().set(
      'a',
      new HydrationMap<string, boolean>().set('b', true),
    )
    const b = new HydrationMap<string, HydrationMap<string, boolean>>().set(
      'a',
      new HydrationMap<string, boolean>().set('c', true),
    )
    const merged = mergeNestedMaps(a, b)

    expect(mapToObj(merged!)).toEqual(mapToObj(compare))
  })
})
