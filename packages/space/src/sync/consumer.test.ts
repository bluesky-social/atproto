import { describe, expect, it } from 'vitest'
import { P256Keypair, randomBytes } from '@atproto/crypto'
import { encode } from '@atproto/lex-cbor'
import { type LexMap, ui8Concat } from '@atproto/lex-data'
import { type StarPair, writeStar } from '@atproto/star'
import type {
  DidString,
  SpaceAtUriString,
  SpaceRefString,
} from '@atproto/syntax'
import { decapsulate, encapsulate } from '../kem.js'
import {
  COMMIT_MAC_PROFILE,
  type CreateMacParams,
  type MacProfile,
  RECORD_MAC_PROFILE,
  type VerifyMacParams,
  createCommitMacHeaders,
  createRecordMacHeaders,
  formatMacRequest,
  parseMacRequest,
} from '../mac.js'
import { RepoCommit } from '../repo-commit.js'
import type { CommitCtx, RecordPathParts, SpaceRecord } from '../types.js'
import {
  type VerifiedRecord,
  readRepoStar,
  verifyRecord,
  verifyRepoStar,
  verifyRepoStarFull,
} from './consumer.js'
import { serializeRecord, writeRepoStar } from './provider.js'

const SPACE: SpaceRefString = 'at://did:example:space/space/app.bsky.group/test'
const ctx: CommitCtx = {
  space: SPACE,
  repo: 'did:example:alice',
  rev: '3kbcq3p7ad42b',
}

// In path order: likes sort before posts.
const RECORDS: (RecordPathParts & { record: SpaceRecord })[] = [
  {
    collection: 'app.bsky.feed.like',
    rkey: '3kbcq3p7ad403',
    record: { subject: 'at://x' },
  },
  {
    collection: 'app.bsky.feed.post',
    rkey: '3kbcq3p7ad401',
    record: { text: 'hello' },
  },
  {
    collection: 'app.bsky.feed.post',
    rkey: '3kbcq3p7ad402',
    record: { text: 'world' },
  },
]

const serialized = await Promise.all(
  RECORDS.map((r) => serializeRecord(r.collection, r.rkey, r.record)),
)
const verified = RECORDS.map((r, i) => ({ ...r, cid: serialized[i].cid }))
const commit = RepoCommit.fromRecords(serialized).toCommit(ctx)

const utf8 = (str: string) => new TextEncoder().encode(str)

const collect = async (stream: AsyncIterable<Uint8Array>) => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return ui8Concat(chunks)
}

const pairs: StarPair[] = serialized.map((r) => ({
  key: utf8(`${r.collection}/${r.rkey}`),
  value: r.bytes,
}))

const repoStar = await collect(writeRepoStar(commit, serialized))

// An archive of `commit` written as given, for what writeRepoStar refuses to
// write.
const rawStar = (starPairs: StarPair[], meta: LexMap = {}) =>
  collect(
    writeStar({ $type: 'atproto-space-repo', ...commit, ...meta }, starPairs),
  )

async function readAll(star: Uint8Array) {
  await using repo = await readRepoStar([star])
  const records: VerifiedRecord[] = []
  for await (const record of repo.records) records.push(record)
  return { commit: repo.commit, records }
}

// A single-chunk input that notes when its reader closes it.
function closableInput(bytes: Uint8Array) {
  const input = {
    closed: false,
    async *[Symbol.asyncIterator]() {
      try {
        yield bytes
      } finally {
        input.closed = true
      }
    },
  }
  return input
}

// What a syncer verifies a response with, after the host MACs it under the
// secret they share.
async function macFor(
  profile: MacProfile,
  createHeaders: (params: CreateMacParams) => {
    headers: Record<string, string>
  },
): Promise<VerifyMacParams> {
  const kemKey = await P256Keypair.create()
  const { keyShare, sharedSecret } = await encapsulate(
    kemKey.did() as DidString,
  )
  const request = parseMacRequest(formatMacRequest(profile, keyShare), profile)!
  const { headers } = createHeaders({
    ...request,
    sharedSecret: decapsulate(kemKey, keyShare),
  })
  return { keyShare, sharedSecret, headers: new Headers(headers) }
}

const commitMac = () =>
  macFor(COMMIT_MAC_PROFILE, (params) => createCommitMacHeaders(commit, params))

describe(readRepoStar, () => {
  it('reads the commit and records', async () => {
    await expect(readAll(repoStar)).resolves.toEqual({
      commit: expect.objectContaining(commit),
      records: verified,
    })
  })

  it('reads an empty repo', async () => {
    const empty = new RepoCommit().toCommit(ctx)
    const star = await collect(writeRepoStar(empty, []))
    await expect(readAll(star)).resolves.toEqual({
      commit: expect.objectContaining(empty),
      records: [],
    })
  })

  it.each([
    {
      note: 'another $type',
      meta: { $type: 'atproto-space-meta' },
      message: /invalid repo metadata/,
    },
    {
      note: 'a rev that is not a TID',
      meta: { rev: 'not-a-tid' },
      message: /invalid repo metadata/,
    },
    {
      note: 'an unknown version',
      meta: { ver: 2 },
      message: /unsupported commit version: 2/,
    },
  ])('rejects metadata with $note', async ({ meta, message }) => {
    await expect(readAll(await rawStar(pairs, meta))).rejects.toThrow(message)
  })

  it.each([
    {
      note: 'leave out a committed record',
      pairs: pairs.slice(0, -1),
      message: /records do not match the commit data/,
    },
    {
      note: 'add an uncommitted record',
      pairs: [
        ...pairs,
        {
          key: utf8('app.bsky.feed.post/3kbcq3p7ad404'),
          value: encode({ text: 'extra' }),
        },
      ],
      message: /records do not match the commit data/,
    },
    {
      note: 'change a committed value',
      pairs: [
        { ...pairs[0], value: encode({ subject: 'at://y' }) },
        ...pairs.slice(1),
      ],
      message: /records do not match the commit data/,
    },
    {
      note: 'are out of order',
      pairs: [pairs[1], pairs[0], pairs[2]],
      message: /records out of order at app.bsky.feed.like/,
    },
    {
      note: 'repeat a path',
      pairs: [pairs[0], ...pairs],
      message: /records out of order at app.bsky.feed.like/,
    },
    {
      note: 'have an invalid path',
      pairs: [{ key: utf8('not-a-path'), value: encode({}) }],
      message: /invalid record path: not-a-path/,
    },
    {
      note: 'are not valid cbor',
      pairs: [{ ...pairs[0], value: Uint8Array.of(0xa1) }],
      message: /invalid record cbor at app.bsky.feed.like/,
    },
    {
      note: 'are not maps',
      pairs: [{ ...pairs[0], value: encode('hello') }],
      message: /invalid record at app.bsky.feed.like/,
    },
  ])('rejects records that $note', async ({ pairs, message }) => {
    await expect(readAll(await rawStar(pairs))).rejects.toThrow(message)
  })

  it.each([
    {
      note: 'metadata over 64 KiB',
      meta: { filler: 'x'.repeat(64 * 1024) },
      pairs: [],
      message: /exceeds limit of 65536/,
    },
    {
      note: 'a record path over 4 KiB',
      meta: {},
      pairs: [
        {
          key: utf8(`app.bsky.feed.post/${'x'.repeat(4 * 1024)}`),
          value: encode({}),
        },
      ],
      message: /exceeds limit of 4096/,
    },
  ])('rejects $note', async ({ meta, pairs, message }) => {
    await expect(readAll(await rawStar(pairs, meta))).rejects.toThrow(message)
  })

  it('rejects a record over 1 MiB without reading it', async () => {
    // Cut off after the value's length: the length alone must reject it.
    const value = new Uint8Array(1024 * 1024 + 1)
    const star = await rawStar([{ key: pairs[0].key, value }])
    const truncated = star.subarray(0, star.length - value.length - 1)
    await expect(readAll(truncated)).rejects.toThrow(/exceeds limit of 1048576/)
  })

  it('closes its input when the metadata is invalid', async () => {
    const input = closableInput(await rawStar(pairs, { ver: 2 }))
    await expect(readRepoStar(input)).rejects.toThrow(
      /unsupported commit version/,
    )
    expect(input.closed).toBe(true)
  })
})

describe(verifyRepoStarFull, () => {
  it('verifies a repo and collects its records', async () => {
    await expect(
      verifyRepoStarFull([repoStar], { ...ctx, ...(await commitMac()) }),
    ).resolves.toEqual({
      commit: expect.objectContaining(commit),
      records: verified,
    })
  })
})

describe(verifyRepoStar, () => {
  it('verifies the commit before reading records, closing its input on failure', async () => {
    const input = closableInput(repoStar)
    const mac = await commitMac()
    await expect(
      verifyRepoStar(input, { ...ctx, ...mac, sharedSecret: randomBytes(32) }),
    ).rejects.toThrow(/MAC does not match/)
    expect(input.closed).toBe(true)
  })
})

describe(verifyRecord, () => {
  const uri: SpaceAtUriString =
    'at://did:example:space/space/app.bsky.group/test/did:example:alice/app.bsky.feed.post/3kbcq3p7ad401'
  const { cid, record: value } = verified[1]
  const record = { uri, cid: cid.toString(), value }

  const recordParams = async () => ({
    uri,
    ...(await macFor(RECORD_MAC_PROFILE, (params) =>
      createRecordMacHeaders(uri, cid, params),
    )),
  })

  it('accepts the requested record under its MAC', async () => {
    await expect(
      verifyRecord(record, await recordParams()),
    ).resolves.toBeUndefined()
  })

  it('rejects a record other than the one requested', async () => {
    const other: SpaceAtUriString =
      'at://did:example:space/space/app.bsky.group/test/did:example:alice/app.bsky.feed.post/3kbcq3p7ad402'
    await expect(
      verifyRecord(record, { ...(await recordParams()), uri: other }),
    ).rejects.toThrow(/record is not the one requested/)
  })

  it('rejects a MAC under another shared secret', async () => {
    const params = { ...(await recordParams()), sharedSecret: randomBytes(32) }
    await expect(verifyRecord(record, params)).rejects.toThrow(
      /MAC does not match/,
    )
  })

  it('rejects a value that does not match its cid', async () => {
    await expect(
      verifyRecord(
        { ...record, value: { text: 'world' } },
        await recordParams(),
      ),
    ).rejects.toThrow(/record value does not match its cid/)
  })

  it('rejects a malformed cid', async () => {
    await expect(
      verifyRecord({ ...record, cid: 'nope' }, await recordParams()),
    ).rejects.toThrow(/invalid record cid: nope/)
  })
})
