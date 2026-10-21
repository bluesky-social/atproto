import { beforeAll, describe, expect, it } from 'vitest'
import { encodeVarInt } from '@atproto/car'
import { randomBytes } from '@atproto/crypto'
import { encode } from '@atproto/lex-cbor'
import type { Cid } from '@atproto/lex-data'
import {
  type Commit,
  type CommitCtx,
  MAX_RECORD_SIZE,
  REPO_STAR_TYPE,
  RepoCommit,
  RepoVerificationError,
  type SerializedRecord,
  type StarPair,
  StarParseError,
  computeCommitMac,
  readStar,
  serializeRecord,
  serializeRepo,
  verifyCommit,
  verifyRepoStar,
  verifyRepoStarFull,
  writeStar,
} from '../src/index.js'

const SPACE = 'at://did:example:space/space/app.bsky.group/test'
const AUTHOR = 'did:example:alice'
const REV = '3kbcq3p7ad400'

const ctx: CommitCtx = { space: SPACE, repo: AUTHOR, rev: REV }

const collect = async (
  stream: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

const drain = async (records: AsyncIterable<unknown>): Promise<void> => {
  for await (const _ of records) {
    // drain
  }
}

const utf8 = (str: string) => new TextEncoder().encode(str)

describe('space sync', () => {
  // Stands in for the secret a syncer and repo host derive for one request.
  const sharedSecret = randomBytes(32)
  // In path order: likes sort before posts.
  let records: (SerializedRecord & { cid: Cid })[]

  beforeAll(async () => {
    records = await Promise.all([
      serializeRecord('app.bsky.feed.like', '3kbcq3p7ad403', {
        subject: 'at://x',
      }),
      serializeRecord('app.bsky.feed.post', '3kbcq3p7ad401', {
        text: 'hello',
      }),
      serializeRecord('app.bsky.feed.post', '3kbcq3p7ad402', {
        text: 'world',
      }),
    ])
  })

  const commitFor = (recs: (SerializedRecord & { cid: Cid })[]): Commit =>
    RepoCommit.fromRecords(recs).toCommit(ctx)

  // What a syncer verifies a response with: the repo it asked for, and the MAC
  // the host sent back for the commit over `recs`.
  const params = (recs: (SerializedRecord & { cid: Cid })[] = records) => ({
    space: SPACE,
    repo: AUTHOR,
    sharedSecret,
    mac: computeCommitMac(sharedSecret, commitFor(recs)),
  })

  const starFor = (
    recs: (SerializedRecord & { cid: Cid })[],
  ): Promise<Uint8Array> => collect(serializeRepo(commitFor(recs), recs))

  // Hand-builds an archive, for writing what serializeRepo refuses to.
  const rawStar = (commit: Commit, pairs: StarPair[], meta = {}) =>
    collect(writeStar({ $type: REPO_STAR_TYPE, ...commit, ...meta }, pairs))

  const pairsFor = (recs: SerializedRecord[]): StarPair[] =>
    recs.map((r) => ({
      key: utf8(`${r.collection}/${r.rkey}`),
      value: r.bytes,
    }))

  it('writes the commit as metadata, then one pair per record', async () => {
    const commit = commitFor(records)
    const star = await collect(serializeRepo(commit, records))
    await using reader = await readStar([star])
    expect(reader.meta).toEqual({ $type: REPO_STAR_TYPE, ...commit })

    const keys: string[] = []
    for await (const { key } of reader.pairs) {
      keys.push(new TextDecoder().decode(key))
    }
    expect(keys).toEqual(records.map((r) => `${r.collection}/${r.rkey}`))
  })

  it('round-trips through verification', async () => {
    const star = await starFor(records)
    const recovered = await verifyRepoStarFull([star], params())

    expect(recovered.commit.rev).toBe(REV)
    expect(recovered.records).toHaveLength(records.length)
    expect(
      RepoCommit.fromRecords(recovered.records).matches(recovered.commit),
    ).toBe(true)

    for (const original of records) {
      const found = recovered.records.find(
        (r) => r.collection === original.collection && r.rkey === original.rkey,
      )
      expect(found).toBeDefined()
      expect(found!.cid.equals(original.cid)).toBe(true)
    }
  })

  it('recovers record values intact', async () => {
    const star = await starFor(records)
    const { records: recovered } = await verifyRepoStarFull([star], params())
    const post = recovered.find((r) => r.rkey === '3kbcq3p7ad401')
    expect(post?.record).toEqual({ text: 'hello' })
  })

  it('serializes an empty repo', async () => {
    const star = await starFor([])
    const recovered = await verifyRepoStarFull([star], params([]))
    expect(recovered.records).toHaveLength(0)
  })

  it('refuses to serialize records out of path order', async () => {
    const commit = commitFor(records)
    await expect(
      collect(serializeRepo(commit, [records[1], records[0]])),
    ).rejects.toThrow(/records out of order/)
  })

  it('verifies the commit before reading any record', async () => {
    const star = await starFor(records)
    await expect(
      verifyRepoStar([star], { ...params(), sharedSecret: randomBytes(32) }),
    ).rejects.toThrow(/commit failed verification/)
  })

  describe('rejects tampering', () => {
    it('rejects an archive for another author', async () => {
      const star = await starFor(records)
      await expect(
        verifyRepoStarFull([star], { ...params(), repo: 'did:example:bob' }),
      ).rejects.toThrow(/commit failed verification/)
    })

    it('rejects an archive for another space', async () => {
      const star = await starFor(records)
      await expect(
        verifyRepoStarFull([star], {
          ...params(),
          space: 'at://did:example:space/space/app.bsky.group/other',
        }),
      ).rejects.toThrow(/commit failed verification/)
    })

    it('rejects metadata relabelled with another author', async () => {
      // MACed for alice, but claims to be bob's repo.
      const star = await rawStar(commitFor(records), pairsFor(records), {
        repo: 'did:example:bob',
      })
      await expect(
        verifyRepoStarFull([star], { ...params(), repo: 'did:example:bob' }),
      ).rejects.toThrow(/commit failed verification/)
    })

    it('rejects the wrong metadata $type', async () => {
      const star = await rawStar(commitFor(records), pairsFor(records), {
        $type: 'atproto-public-repo',
      })
      await expect(verifyRepoStarFull([star], params())).rejects.toThrow(
        /invalid repo metadata/,
      )
    })

    it('rejects an unknown commit version', async () => {
      const star = await rawStar(commitFor(records), pairsFor(records), {
        ver: 2,
      })
      await expect(verifyRepoStarFull([star], params())).rejects.toThrow(
        /commit failed verification/,
      )
    })

    it('rejects a repo missing a record', async () => {
      const star = await rawStar(
        commitFor(records),
        pairsFor(records.slice(0, -1)),
      )
      // The commit itself is fine, so this only surfaces once records are drained.
      const { records: stream } = await verifyRepoStar([star], params())
      await expect(drain(stream)).rejects.toThrow(
        /records do not match the commit data/,
      )
    })

    it('rejects a repo with an extra record', async () => {
      const star = await rawStar(
        commitFor(records.slice(0, -1)),
        pairsFor(records),
      )
      await expect(
        verifyRepoStarFull([star], params(records.slice(0, -1))),
      ).rejects.toThrow(/records do not match the commit data/)
    })

    it('rejects a record whose value was swapped', async () => {
      const pairs = pairsFor(records)
      pairs[0] = { ...pairs[0], value: encode({ text: 'tampered' }) }
      const star = await rawStar(commitFor(records), pairs)
      await expect(verifyRepoStarFull([star], params())).rejects.toThrow(
        /records do not match the commit data/,
      )
    })

    it('rejects records out of order', async () => {
      const pairs = pairsFor(records)
      const star = await rawStar(commitFor(records), [
        pairs[1],
        pairs[0],
        pairs[2],
      ])
      await expect(verifyRepoStarFull([star], params())).rejects.toThrow(
        /records out of order/,
      )
    })

    it('rejects a duplicate record', async () => {
      const pairs = pairsFor(records)
      const star = await rawStar(commitFor(records), [
        pairs[0],
        pairs[0],
        pairs[1],
        pairs[2],
      ])
      await expect(verifyRepoStarFull([star], params())).rejects.toThrow(
        /records out of order/,
      )
    })

    it('rejects an invalid record path', async () => {
      const star = await rawStar(commitFor([]), [
        { key: utf8('not-a-path'), value: encode({}) },
      ])
      await expect(verifyRepoStarFull([star], params([]))).rejects.toThrow(
        /invalid record path/,
      )
    })

    it('rejects an oversized record before reading it', async () => {
      // A pair that declares a value one byte over the limit, with none of the
      // value's bytes following: the length alone must be enough to reject it.
      const key = utf8('app.bsky.feed.post/3kbcq3p7ad401')
      const star = Buffer.concat([
        await rawStar(commitFor([]), []),
        encodeVarInt(key.length),
        key,
        encodeVarInt(MAX_RECORD_SIZE + 1),
      ])
      await expect(verifyRepoStarFull([star], params([]))).rejects.toThrow(
        /exceeds limit of 1048576/,
      )
    })

    it('rejects a record that is not a map', async () => {
      const star = await rawStar(commitFor([]), [
        { key: utf8('app.bsky.feed.post/3kbcq3p7ad401'), value: encode('hi') },
      ])
      await expect(verifyRepoStarFull([star], params([]))).rejects.toThrow(
        /invalid record at/,
      )
    })
  })

  describe('STAR framing', () => {
    it('rejects a truncated archive', async () => {
      const star = await starFor(records)
      const { records: stream } = await verifyRepoStar(
        [star.subarray(0, -1)],
        params(),
      )
      await expect(drain(stream)).rejects.toThrow(StarParseError)
    })

    it('rejects an archive truncated in its header', async () => {
      const star = await starFor(records)
      await expect(
        verifyRepoStar([star.subarray(0, 3)], params()),
      ).rejects.toThrow(StarParseError)
    })

    it('reads an archive delivered in arbitrary chunk boundaries', async () => {
      const star = await starFor(records)
      // One byte at a time — exercises the reader's buffering.
      const chunks = Array.from(star, (byte) => new Uint8Array([byte]))
      const recovered = await verifyRepoStarFull(chunks, params())
      expect(recovered.records).toHaveLength(records.length)
    })
  })

  it('throws RepoVerificationError for a bad repo', async () => {
    const star = await starFor(records)
    await expect(
      verifyRepoStarFull([star], { ...params(), repo: 'did:example:bob' }),
    ).rejects.toThrow(RepoVerificationError)
  })

  // A syncer advances its own copy over the oplog, then checks it against the
  // repo's commit. A mismatch means it must fall back to full recovery.
  describe('incremental sync', () => {
    const createOps = (recs: (SerializedRecord & { cid: Cid })[]) =>
      recs.map((r) => ({
        collection: r.collection,
        rkey: r.rkey,
        cid: r.cid,
        prev: null,
      }))

    it('catches up to a commit by replaying the oplog', async () => {
      const commit = commitFor(records)
      const local = new RepoCommit().applyOps(createOps(records))

      expect(verifyCommit(commit, params())).toBe(true)
      expect(local.matches(commit)).toBe(true)
    })

    it('detects divergence when an op was missed', async () => {
      const commit = commitFor(records)
      const local = new RepoCommit().applyOps(createOps(records.slice(0, 2)))
      expect(local.matches(commit)).toBe(false)
    })

    it('replays deletes and updates', () => {
      const [a, b] = records
      const local = RepoCommit.fromRecords([a]).applyOps([
        { collection: a.collection, rkey: a.rkey, cid: b.cid, prev: a.cid },
        { collection: a.collection, rkey: a.rkey, cid: null, prev: b.cid },
      ])
      expect(local.setHash.isEmpty()).toBe(true)
    })
  })
})
