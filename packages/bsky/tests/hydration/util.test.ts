import {
  HydrationMap,
  mergeManyMaps,
  mergeMaps,
  mergeNestedMaps,
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
})
