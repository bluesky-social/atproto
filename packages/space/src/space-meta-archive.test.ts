import { describe, expect, it } from 'vitest'
import { encode } from '@atproto/lex-cbor'
import { type LexMap, ui8Concat } from '@atproto/lex-data'
import { readStar, writeStar } from '@atproto/star'
import type { DidString, SpaceRefString } from '@atproto/syntax'
import {
  type SpaceMetaArchive,
  readSpaceMetaStar,
  writeSpaceMetaStar,
} from './space-meta-archive.js'

const SPACE: SpaceRefString =
  'at:space/did:example:forum/com.example.forum/general'

const POLICY = { $type: 'com.example.policy', readAccess: 'members' }
const MEMBER = { $type: 'com.example.member', read: true, write: true }
const WRITER = {
  repoRev: '3kbcq3p7ad42b',
  data: new Uint8Array(32).fill(1),
  spaceRev: '3kbcq3p7ad42c',
}

const member = (did: string) => ({
  key: `com.example.member/${did}`,
  value: MEMBER,
})
const writer = (did: string) => ({ did: did as DidString, ...WRITER })

const utf8 = (str: string) => new TextEncoder().encode(str)

const collect = async (stream: AsyncIterable<Uint8Array>) => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return ui8Concat(chunks)
}

// An archive written as given, for what writeSpaceMetaStar won't write. Byte
// values are written raw.
const rawArchive = (pairs: [string, LexMap | Uint8Array][], meta = {}) =>
  collect(
    writeStar(
      { $type: 'atproto-space-meta', ver: 1, space: SPACE, ...meta },
      pairs.map(([key, value]) => ({
        key: utf8(key),
        value: value instanceof Uint8Array ? value : encode(value),
      })),
    ),
  )

describe(writeSpaceMetaStar, () => {
  const archive: SpaceMetaArchive = {
    space: SPACE,
    policy: POLICY,
    policyState: [member('did:example:carol'), member('did:example:alice')],
    writers: [writer('did:example:carol'), writer('did:example:alice')],
  }

  it('writes the space as metadata, then the sections in key order', async () => {
    const star = await collect(writeSpaceMetaStar(archive))
    await using reader = await readStar([star])
    const keys: string[] = []
    for await (const { key } of reader.pairs) {
      keys.push(new TextDecoder().decode(key))
    }

    expect(reader.meta).toEqual({
      $type: 'atproto-space-meta',
      ver: 1,
      space: SPACE,
    })
    expect(keys).toEqual([
      'policy',
      'com.example.member/did:example:alice',
      'com.example.member/did:example:carol',
      'writer/did:example:alice',
      'writer/did:example:carol',
    ])
  })

  it('round-trips through readSpaceMetaStar', async () => {
    const star = await collect(writeSpaceMetaStar(archive))
    await expect(readSpaceMetaStar([star])).resolves.toEqual({
      ...archive,
      policyState: [member('did:example:alice'), member('did:example:carol')],
      writers: [writer('did:example:alice'), writer('did:example:carol')],
    })
  })

  it('round-trips a space with no policy state or writers', async () => {
    const empty = { space: SPACE, policy: POLICY, policyState: [], writers: [] }
    const star = await collect(writeSpaceMetaStar(empty))
    await expect(readSpaceMetaStar([star])).resolves.toEqual(empty)
  })
})

describe(readSpaceMetaStar, () => {
  it('takes a writer DID from its key, ignoring one in its value', async () => {
    const star = await rawArchive([
      ['policy', POLICY],
      ['writer/did:example:bob', { ...WRITER, did: 'not a did' }],
    ])
    await expect(readSpaceMetaStar([star])).resolves.toMatchObject({
      writers: [writer('did:example:bob')],
    })
  })

  it('rejects an archive without a policy', async () => {
    const star = await rawArchive([
      ['com.example.member/did:example:bob', MEMBER],
    ])
    await expect(readSpaceMetaStar([star])).rejects.toThrow(/missing policy/)
  })

  it.each<{
    note: string
    pairs: [string, LexMap | Uint8Array][]
    message: RegExp
  }>([
    {
      note: 'policy state before the policy',
      pairs: [
        ['com.example.member/did:example:bob', MEMBER],
        ['policy', POLICY],
      ],
      message: /section out of order at policy/,
    },
    {
      note: 'policy state after the writers',
      pairs: [
        ['policy', POLICY],
        ['writer/did:example:bob', WRITER],
        ['com.example.member/did:example:bob', MEMBER],
      ],
      message: /section out of order at com.example.member/,
    },
    {
      note: 'a duplicate key',
      pairs: [
        ['policy', POLICY],
        ['com.example.member/did:example:bob', MEMBER],
        ['com.example.member/did:example:bob', MEMBER],
      ],
      message: /duplicate or out-of-order key/,
    },
    {
      note: 'keys out of order within a section',
      pairs: [
        ['policy', POLICY],
        ['writer/did:example:carol', WRITER],
        ['writer/did:example:bob', WRITER],
      ],
      message: /duplicate or out-of-order key: writer\/did:example:bob/,
    },
    {
      note: 'a writer key without a valid DID',
      pairs: [
        ['policy', POLICY],
        ['writer/bob', WRITER],
      ],
      message: /invalid DID in writer key/,
    },
    {
      note: 'a writer without a repoRev',
      pairs: [
        ['policy', POLICY],
        ['writer/did:example:bob', { ...WRITER, repoRev: undefined }],
      ],
      message: /invalid writer: .*"repoRev"/,
    },
    {
      note: 'a writer without a spaceRev',
      pairs: [
        ['policy', POLICY],
        ['writer/did:example:bob', { ...WRITER, spaceRev: undefined }],
      ],
      message: /invalid writer: .*"spaceRev"/,
    },
    {
      note: 'a value that is not a map',
      pairs: [['policy', encode('members')]],
      message: /value at policy is not a map/,
    },
    {
      note: 'a value that is not valid cbor',
      pairs: [['policy', Uint8Array.of(0xa1)]],
      message: /invalid cbor at policy/,
    },
  ])('rejects $note', async ({ pairs, message }) => {
    const star = await rawArchive(pairs)
    await expect(readSpaceMetaStar([star])).rejects.toThrow(message)
  })

  it.each([
    { note: 'another $type', meta: { $type: 'atproto-space-repo' } },
    { note: 'an unknown version', meta: { ver: 2 } },
  ])('rejects metadata with $note', async ({ meta }) => {
    const star = await rawArchive([['policy', POLICY]], meta)
    await expect(readSpaceMetaStar([star])).rejects.toThrow(
      /invalid space meta archive metadata/,
    )
  })

  it.each<{
    note: string
    pairs: [string, LexMap][]
    meta?: LexMap
    limit: number
  }>([
    {
      note: 'metadata over 64 KiB',
      pairs: [['policy', POLICY]],
      meta: { filler: 'x'.repeat(64 * 1024) },
      limit: 64 * 1024,
    },
    {
      note: 'a key over 4 KiB',
      pairs: [
        ['policy', POLICY],
        [`com.example.member/${'x'.repeat(4 * 1024)}`, MEMBER],
      ],
      limit: 4 * 1024,
    },
    {
      note: 'a value over 1 MiB',
      pairs: [['policy', { ...POLICY, filler: 'x'.repeat(1024 * 1024) }]],
      limit: 1024 * 1024,
    },
  ])('rejects $note', async ({ pairs, meta, limit }) => {
    const star = await rawArchive(pairs, meta)
    await expect(readSpaceMetaStar([star])).rejects.toThrow(
      `exceeds limit of ${limit}`,
    )
  })
})
