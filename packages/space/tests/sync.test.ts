import { beforeAll, describe, expect, it } from 'vitest'
import { encodeCarBlock, encodeCarHeader, readCarStream } from '@atproto/common'
import { type Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { encode } from '@atproto/lex-cbor'
import { type Cid, cidForCbor } from '@atproto/lex-data'
import {
  type CommitCtx,
  RepoCommit,
  RepoVerificationError,
  type SerializedRecord,
  type SignedCommit,
  serializeRecord,
  serializeRepo,
  verifyCommit,
  verifyRepoCar,
  verifyRepoCarFull,
} from '../src/index.js'

const SPACE = 'at://did:example:space/space/app.bsky.group/test'
const AUTHOR = 'did:example:alice'
const REV = '3kbcq3p7ad400'

const ctx: CommitCtx = { space: SPACE, author: AUTHOR, rev: REV }

const collect = async (
  stream: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

describe('space sync', () => {
  let keypair: Keypair
  let records: SerializedRecord[]

  beforeAll(async () => {
    keypair = await Secp256k1Keypair.create()
    records = await Promise.all([
      serializeRecord('app.bsky.feed.post', '3kbcq3p7ad401', {
        text: 'hello',
      }),
      serializeRecord('app.bsky.feed.post', '3kbcq3p7ad402', {
        text: 'world',
      }),
      serializeRecord('app.bsky.feed.like', '3kbcq3p7ad403', {
        subject: 'at://x',
      }),
    ])
  })

  const commitFor = (recs: SerializedRecord[]): Promise<SignedCommit> =>
    RepoCommit.fromRecords(recs).sign(ctx, keypair)

  const carFor = async (recs: SerializedRecord[]): Promise<Uint8Array> =>
    collect(serializeRepo(await commitFor(recs), recs))

  it('declares the commit and index as roots, in order', async () => {
    const car = await carFor(records)
    const { roots, blocks } = await readCarStream([car])
    expect(roots).toHaveLength(2)

    const seen: Cid[] = []
    for await (const block of blocks) seen.push(block.cid)
    // Two roots, then one block per record.
    expect(seen).toHaveLength(2 + records.length)
    expect(seen[0].equals(roots[0])).toBe(true)
    expect(seen[1].equals(roots[1])).toBe(true)
  })

  it('round-trips through verification', async () => {
    const car = await carFor(records)
    const recovered = await verifyRepoCarFull([car], {
      space: SPACE,
      author: AUTHOR,
      didKey: keypair.did(),
    })

    expect(recovered.commit.rev).toBe(REV)
    expect(Object.keys(recovered.index)).toHaveLength(records.length)
    expect(recovered.records).toHaveLength(records.length)
    expect(recovered.repo.matches(recovered.commit)).toBe(true)

    for (const original of records) {
      const found = recovered.records.find(
        (r) => r.collection === original.collection && r.rkey === original.rkey,
      )
      expect(found).toBeDefined()
      expect(found!.cid.equals(original.cid)).toBe(true)
    }
  })

  it('recovers record values intact', async () => {
    const car = await carFor(records)
    const { records: recovered } = await verifyRepoCarFull([car], {
      space: SPACE,
      author: AUTHOR,
      didKey: keypair.did(),
    })
    const post = recovered.find((r) => r.rkey === '3kbcq3p7ad401')
    expect(post?.record).toEqual({ text: 'hello' })
  })

  it('serializes an empty repo', async () => {
    const car = await carFor([])
    const recovered = await verifyRepoCarFull([car], {
      space: SPACE,
      author: AUTHOR,
      didKey: keypair.did(),
    })
    expect(Object.keys(recovered.index)).toHaveLength(0)
    expect(recovered.records).toHaveLength(0)
    expect(recovered.repo.setHash.isEmpty()).toBe(true)
  })

  it('emits record blocks in the index order', async () => {
    const car = await carFor(records)
    const { index } = await verifyRepoCarFull([car], {
      space: SPACE,
      author: AUTHOR,
      didKey: keypair.did(),
    })
    // Re-read the raw blocks and check they follow the index's declared order.
    const { blocks } = await readCarStream([car])
    const cids: Cid[] = []
    for await (const block of blocks) cids.push(block.cid)
    const recordCids = cids.slice(2).map((c) => c.toString())
    const indexCids = Object.values(index).map((c) => c.toString())
    expect(recordCids).toEqual(indexCids)
  })

  it('authenticates the index without reading records', async () => {
    const car = await carFor(records)
    // verifyRepoCar validates commit + index eagerly; records stay lazy.
    const { index, repo, commit } = await verifyRepoCar([car], {
      space: SPACE,
      author: AUTHOR,
      didKey: keypair.did(),
    })
    expect(repo.matches(commit)).toBe(true)
    expect(Object.keys(index)).toHaveLength(records.length)
  })

  describe('rejects tampering', () => {
    it('rejects a commit signed by another key', async () => {
      const other = await Secp256k1Keypair.create()
      const car = await carFor(records)
      await expect(
        verifyRepoCarFull([car], {
          space: SPACE,
          author: AUTHOR,
          didKey: other.did(),
        }),
      ).rejects.toThrow(RepoVerificationError)
    })

    it('rejects a repo verified against the wrong space', async () => {
      const car = await carFor(records)
      await expect(
        verifyRepoCarFull([car], {
          space: 'at://did:example:space/space/app.bsky.group/other',
          author: AUTHOR,
          didKey: keypair.did(),
        }),
      ).rejects.toThrow(/commit failed verification/)
    })

    it('rejects a repo verified against the wrong author', async () => {
      const car = await carFor(records)
      await expect(
        verifyRepoCarFull([car], {
          space: SPACE,
          author: 'did:example:bob',
          didKey: keypair.did(),
        }),
      ).rejects.toThrow(/commit failed verification/)
    })

    it('rejects an index that disagrees with the commit hash', async () => {
      // A commit over two records, but an index listing all three.
      const commit = await commitFor(records.slice(0, 2))
      const car = await collect(serializeRepo(commit, records))
      await expect(
        verifyRepoCarFull([car], {
          space: SPACE,
          author: AUTHOR,
          didKey: keypair.did(),
        }),
      ).rejects.toThrow(/index does not match the commit hash/)
    })

    it('rejects a record block whose bytes do not match its cid', async () => {
      const commit = await commitFor(records)
      const index: Record<string, Cid> = {}
      for (const r of records) {
        index[`${r.collection}/${r.rkey}`] = r.cid
      }
      const commitBytes = encode(commit)
      const indexBytes = encode(index)
      const [commitCid, indexCid] = await Promise.all([
        cidForCbor(commitBytes),
        cidForCbor(indexBytes),
      ])

      const byPath = new Map(
        records.map((r) => [`${r.collection}/${r.rkey}`, r]),
      )
      const parts = [
        encodeCarHeader([commitCid, indexCid]),
        encodeCarBlock({ cid: commitCid, bytes: commitBytes }),
        encodeCarBlock({ cid: indexCid, bytes: indexBytes }),
        ...Object.keys(index).map((path, i) => {
          const record = byPath.get(path)!
          // Swap in bytes that don't hash to the advertised cid.
          const bytes = i === 0 ? encode({ text: 'tampered' }) : record.bytes
          return encodeCarBlock({ cid: record.cid, bytes })
        }),
      ]

      const { records: stream } = await verifyRepoCar([Buffer.concat(parts)], {
        space: SPACE,
        author: AUTHOR,
        didKey: keypair.did(),
      })
      await expect(async () => {
        for await (const _ of stream) {
          // drain
        }
      }).rejects.toThrow(/not a valid cid for bytes/i)
    })

    it('rejects a CAR missing a record named in the index', async () => {
      const commit = await commitFor(records)
      // Serialize the full index but drop the last block.
      const full = await collect(serializeRepo(commit, records))
      const { blocks } = await readCarStream([full])
      const kept: Uint8Array[] = []
      const all = []
      for await (const block of blocks) all.push(block)
      for (const block of all.slice(0, -1)) kept.push(encodeCarBlock(block))

      const { roots } = await readCarStream([full])
      const truncated = Buffer.concat([encodeCarHeader(roots), ...kept])

      const { records: stream } = await verifyRepoCar([truncated], {
        space: SPACE,
        author: AUTHOR,
        didKey: keypair.did(),
      })
      await expect(async () => {
        for await (const _ of stream) {
          // drain
        }
      }).rejects.toThrow(/missing 1 record\(s\) named in the index/)
    })
  })

  describe('repo index', () => {
    it('folds into the same set hash as the records it describes', async () => {
      const car = await carFor(records)
      const { index, repo } = await verifyRepoCarFull([car], {
        space: SPACE,
        author: AUTHOR,
        didKey: keypair.did(),
      })
      expect(
        RepoCommit.fromIndex(index).setHash.equals(
          RepoCommit.fromRecords(records).setHash,
        ),
      ).toBe(true)
      expect(repo.setHash.equals(RepoCommit.fromRecords(records).setHash)).toBe(
        true,
      )
    })

    it('rejects an index whose values are not cids', async () => {
      const commit = await commitFor(records)
      const commitBytes = encode(commit)
      const indexBytes = encode({ 'app.bsky.feed.post/1': 'not-a-cid' })
      const [commitRoot, indexRoot] = await Promise.all([
        cidForCbor(commitBytes),
        cidForCbor(indexBytes),
      ])
      const car = Buffer.concat([
        encodeCarHeader([commitRoot, indexRoot]),
        encodeCarBlock({ cid: commitRoot, bytes: commitBytes }),
        encodeCarBlock({ cid: indexRoot, bytes: indexBytes }),
      ])

      await expect(
        verifyRepoCarFull([car], {
          space: SPACE,
          author: AUTHOR,
          didKey: keypair.did(),
        }),
      ).rejects.toThrow(/invalid repo index/)
    })
  })

  // A syncer advances its own copy over the oplog, then checks it against the
  // repo's signed commit. A mismatch means it must fall back to full recovery.
  describe('incremental sync', () => {
    const createOps = (recs: SerializedRecord[]) =>
      recs.map((r) => ({
        collection: r.collection,
        rkey: r.rkey,
        cid: r.cid,
        prev: null,
      }))

    it('catches up to a commit by replaying the oplog', async () => {
      const commit = await commitFor(records)
      const local = new RepoCommit().applyOps(createOps(records))

      expect(await verifyCommit(commit, ctx, keypair.did())).toBe(true)
      expect(local.matches(commit)).toBe(true)
    })

    it('detects divergence when an op was missed', async () => {
      const commit = await commitFor(records)
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

  describe('CAR framing', () => {
    // Bad framing surfaces from the CAR reader as a plain Error, as it does for
    // public repos.
    it('rejects a truncated CAR', async () => {
      const car = await carFor(records)
      await expect(
        verifyRepoCar([car.subarray(0, 3)], {
          space: SPACE,
          author: AUTHOR,
          didKey: keypair.did(),
        }),
      ).rejects.toThrow(/not enough data/)
    })

    it('rejects a CAR with the wrong root count', async () => {
      const commit = await commitFor(records)
      const commitBytes = encode({
        ver: commit.ver,
        hash: commit.hash,
        ikm: commit.ikm,
        sig: commit.sig,
        mac: commit.mac,
        rev: commit.rev,
      })
      const commitCid = await cidForCbor(commitBytes)
      const car = Buffer.concat([
        encodeCarHeader([commitCid]),
        encodeCarBlock({ cid: commitCid, bytes: commitBytes }),
      ])
      await expect(
        verifyRepoCar([car], {
          space: SPACE,
          author: AUTHOR,
          didKey: keypair.did(),
        }),
      ).rejects.toThrow(/expected 2 car roots/)
    })

    it('reads a CAR delivered in arbitrary chunk boundaries', async () => {
      const car = await carFor(records)
      // One byte at a time — exercises the reader's buffering.
      const chunks = Array.from(car, (byte) => new Uint8Array([byte]))
      const recovered = await verifyRepoCarFull(chunks, {
        space: SPACE,
        author: AUTHOR,
        didKey: keypair.did(),
      })
      expect(recovered.records).toHaveLength(records.length)
    })
  })
})
