import {
  type DidString,
  type NsidString,
  SpaceRef,
} from '@atproto/syntax'
import {
  type UriRange,
  authoritySpaceRange,
  collectionRecordRange,
  spaceRecordRange,
} from '../../src/actor-store/space/uri-range.js'

const within = (uri: string, range: UriRange) =>
  uri > range.gt && uri < range.lt

const ALICE = 'did:example:alice' as DidString
const TYPE = 'com.example.group' as NsidString
const ref = new SpaceRef(ALICE, TYPE, 'abc')
const space = ref.toString()

const recordUri = (
  r: SpaceRef,
  collection: string,
  rkey: string,
  did: DidString = ALICE,
) => r.recordUri(did, collection as NsidString, rkey).toString()

describe('space uri ranges', () => {
  it('spaceRecordRange covers the uris under the space', () => {
    expect(spaceRecordRange(space)).toEqual({
      gt: `${space}/`,
      lt: `${space}0`,
    })
  })

  it('spaceRecordRange includes records of any collection in the space', () => {
    const range = spaceRecordRange(space)
    for (const collection of ['com.example.foo', 'a.b.c', 'z.z.z']) {
      expect(within(recordUri(ref, collection, 'a'), range)).toBe(true)
    }
  })

  it('spaceRecordRange excludes spaces whose uri extends this one', () => {
    const range = spaceRecordRange(space)
    const longerSkey = new SpaceRef(ALICE, TYPE, 'abcd')
    const longerType = new SpaceRef(
      ALICE,
      'com.example.groupX' as NsidString,
      'abc',
    )
    expect(within(recordUri(longerSkey, 'com.example.foo', 'a'), range)).toBe(
      false,
    )
    expect(within(recordUri(longerType, 'com.example.foo', 'a'), range)).toBe(
      false,
    )
  })

  it('collectionRecordRange includes every rkey in the collection', () => {
    const range = collectionRecordRange(
      space,
      ALICE,
      'com.example.foo' as NsidString,
    )
    for (const rkey of ['a', 'zzz', '3jzfcijpj2z2a']) {
      expect(within(recordUri(ref, 'com.example.foo', rkey), range)).toBe(true)
    }
  })

  it('collectionRecordRange excludes collections that share a prefix', () => {
    const range = collectionRecordRange(
      space,
      ALICE,
      'com.example.foo' as NsidString,
    )
    for (const collection of [
      'com.example.foo.bar',
      'com.example.foo2',
      'com.example.fo',
    ]) {
      expect(within(recordUri(ref, collection, 'a'), range)).toBe(false)
    }
  })

  it('authoritySpaceRange includes the authority’s spaces only', () => {
    const range = authoritySpaceRange(ALICE)
    expect(within(space, range)).toBe(true)
    for (const did of ['did:example:alicea', 'did:example:alic']) {
      const other = new SpaceRef(did as DidString, TYPE, 'abc').toString()
      expect(within(other, range)).toBe(false)
    }
  })
})
