import {
  HydrationMap,
  mergeManyMaps,
  mergeMaps,
  mergeNestedMaps,
} from '../../src/hydration/util'

describe('hydration util', () => {
  it(`mergeMaps: merges two maps`, () => {
    const compare = new HydrationMap<string, string>()
    compare.set('a', 'a')
    compare.set('b', 'b')

    const a = new HydrationMap<string, string>().set('a', 'a')
    const b = new HydrationMap<string, string>().set('b', 'b')
    const merged = mergeMaps(a, b)

    expect(Object.fromEntries(merged!)).toEqual(Object.fromEntries(compare))
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

    expect(Object.fromEntries(merged!)).toEqual(Object.fromEntries(compare))
  })

  it(`mergeNestedMaps: merges two nested maps`, () => {
    const compare = new HydrationMap<HydrationMap<string, string>, string>()
    const compareA = new HydrationMap<string, string>().set('a', 'a')
    const compareB = new HydrationMap<string, string>().set('b', 'b')
    compare.set('a', compareA)
    compare.set('b', compareB)

    const a = new HydrationMap<HydrationMap<string, string>, string>().set(
      'a',
      new HydrationMap<string, string>().set('a', 'a'),
    )
    const b = new HydrationMap<HydrationMap<string, string>, string>().set(
      'b',
      new HydrationMap<string, string>().set('b', 'b'),
    )
    const merged = mergeNestedMaps(a, b)

    expect(Object.fromEntries(merged!)).toEqual(Object.fromEntries(compare))
  })

  it(`mergeNestedMaps: merges two nested maps with common keys`, () => {
    const compare = new HydrationMap<HydrationMap<boolean, string>, string>()
    const compareA = new HydrationMap<boolean, string>()
    compareA.set('b', true)
    compareA.set('c', true)
    compare.set('a', compareA)

    const a = new HydrationMap<HydrationMap<boolean, string>, string>().set(
      'a',
      new HydrationMap<boolean, string>().set('b', true),
    )
    const b = new HydrationMap<HydrationMap<boolean, string>, string>().set(
      'a',
      new HydrationMap<boolean, string>().set('c', true),
    )
    const merged = mergeNestedMaps(a, b)

    expect(Object.fromEntries(merged!)).toEqual(Object.fromEntries(compare))
  })
})
