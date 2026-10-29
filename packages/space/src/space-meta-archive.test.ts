import { describe, expect, it } from 'vitest'
import { encode } from '@atproto/lex-cbor'
import { type LexMap, ui8Concat } from '@atproto/lex-data'
import type { DidString, SpaceRefString } from '@atproto/syntax'
import { SpaceMetaArchiveError } from './error.js'
import {
  type SpaceMetaArchive,
  readSpaceMetaStar,
  serializeSpaceMeta,
} from './space-meta-archive.js'
import { type StarPair, readStar, writeStar } from './star.js'
import { SPACE_META_STAR_TYPE } from './types.js'

const SPACE =
  'at://did:example:forum/space/com.example.forum/general' as SpaceRefString

const POLICY = { $type: 'com.example.policy', readAccess: 'members' }
const MEMBER = { $type: 'com.example.member', read: true, write: true }
const WRITER = {
  rev: '3kbcq3p7ad42b',
  data: new Uint8Array(32).fill(1),
  spaceRev: '3kbcq3p7ad42c',
}

const member = (did: string) => ({
  key: `com.example.member/${did}`,
  value: MEMBER,
})
const writer = (did: string) => ({ did: did as DidString, ...WRITER })

const collect = async (
  stream: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return ui8Concat(chunks)
}

const utf8 = (str: string) => new TextEncoder().encode(str)

// Hand-builds an archive, for writing what serializeSpaceMeta won't.
const rawArchive = (pairs: [string, LexMap][], meta: LexMap = {}) =>
  collect(
    writeStar(
      { $type: SPACE_META_STAR_TYPE, ver: 1, space: SPACE, ...meta },
      pairs.map(([key, value]): StarPair => ({
        key: utf8(key),
        value: encode(value),
      })),
    ),
  )

describe('space meta archive', () => {
  const archive: SpaceMetaArchive = {
    space: SPACE,
    policy: POLICY,
    policyState: [member('did:example:carol'), member('did:example:alice')],
    writers: [writer('did:example:carol'), writer('did:example:alice')],
  }

  it('round-trips, putting each section into key order', async () => {
    const star = await collect(serializeSpaceMeta(archive))
    expect(await readSpaceMetaStar([star])).toEqual({
      ...archive,
      policyState: [member('did:example:alice'), member('did:example:carol')],
      writers: [writer('did:example:alice'), writer('did:example:carol')],
    })
  })

  it('writes the space as metadata, then the sections in order', async () => {
    const star = await collect(serializeSpaceMeta(archive))
    await using reader = await readStar([star])
    expect(reader.meta).toEqual({
      $type: SPACE_META_STAR_TYPE,
      ver: 1,
      space: SPACE,
    })
    const keys: string[] = []
    for await (const { key } of reader.pairs) {
      keys.push(new TextDecoder().decode(key))
    }
    expect(keys).toEqual([
      'policy',
      'com.example.member/did:example:alice',
      'com.example.member/did:example:carol',
      'writer/did:example:alice',
      'writer/did:example:carol',
    ])
  })

  it('round-trips a space with no policy state or writers', async () => {
    const empty = { space: SPACE, policy: POLICY, policyState: [], writers: [] }
    const star = await collect(serializeSpaceMeta(empty))
    expect(await readSpaceMetaStar([star])).toEqual(empty)
  })

  describe('rejects', () => {
    it('a missing policy', async () => {
      const star = await rawArchive([
        ['com.example.member/did:example:bob', MEMBER],
      ])
      await expect(readSpaceMetaStar([star])).rejects.toThrow(/missing policy/)
    })

    it('policy state before the policy', async () => {
      const star = await rawArchive([
        ['com.example.member/did:example:bob', MEMBER],
        ['policy', POLICY],
      ])
      await expect(readSpaceMetaStar([star])).rejects.toThrow(
        /section out of order/,
      )
    })

    it('policy state after the writers', async () => {
      const star = await rawArchive([
        ['policy', POLICY],
        ['writer/did:example:bob', WRITER],
        ['com.example.member/did:example:bob', MEMBER],
      ])
      await expect(readSpaceMetaStar([star])).rejects.toThrow(
        /section out of order/,
      )
    })

    it('a duplicate key', async () => {
      const star = await rawArchive([
        ['policy', POLICY],
        ['com.example.member/did:example:bob', MEMBER],
        ['com.example.member/did:example:bob', MEMBER],
      ])
      await expect(readSpaceMetaStar([star])).rejects.toThrow(
        /duplicate or out-of-order key/,
      )
    })

    it('a duplicate policy', async () => {
      const star = await rawArchive([
        ['policy', POLICY],
        ['policy', POLICY],
      ])
      await expect(readSpaceMetaStar([star])).rejects.toThrow(
        /duplicate or out-of-order key/,
      )
    })

    it('keys out of order within a section', async () => {
      const star = await rawArchive([
        ['policy', POLICY],
        ['writer/did:example:carol', WRITER],
        ['writer/did:example:bob', WRITER],
      ])
      await expect(readSpaceMetaStar([star])).rejects.toThrow(
        /duplicate or out-of-order key/,
      )
    })

    it('a writer key without a valid DID', async () => {
      const star = await rawArchive([
        ['policy', POLICY],
        ['writer/bob', WRITER],
      ])
      await expect(readSpaceMetaStar([star])).rejects.toThrow(
        /invalid DID in writer key/,
      )
    })

    it('a writer missing its space revision', async () => {
      const { spaceRev: _, ...value } = WRITER
      const star = await rawArchive([
        ['policy', POLICY],
        ['writer/did:example:bob', value],
      ])
      await expect(readSpaceMetaStar([star])).rejects.toThrow(/invalid writer/)
    })

    it('the wrong metadata $type', async () => {
      const star = await rawArchive([['policy', POLICY]], {
        $type: 'atproto-space-repo',
      })
      await expect(readSpaceMetaStar([star])).rejects.toThrow(
        /invalid space meta archive metadata/,
      )
    })

    it('an unknown version', async () => {
      const star = await rawArchive([['policy', POLICY]], { ver: 2 })
      await expect(readSpaceMetaStar([star])).rejects.toThrow(
        /invalid space meta archive metadata/,
      )
    })

    it('a value that is not a map', async () => {
      const star = await collect(
        writeStar({ $type: SPACE_META_STAR_TYPE, ver: 1, space: SPACE }, [
          { key: utf8('policy'), value: encode('memberspace') },
        ]),
      )
      await expect(readSpaceMetaStar([star])).rejects.toThrow(
        SpaceMetaArchiveError,
      )
    })
  })
})
