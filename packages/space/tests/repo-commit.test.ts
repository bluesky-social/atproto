import { beforeAll, describe, expect, it } from 'vitest'
import { type Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { parseCid } from '@atproto/lex-data'
import {
  type CommitCtx,
  LTHASH_STATE_BYTES,
  RepoCommit,
  type SignedCommit,
  encodeCommitCtx,
  formatSetHashElement,
  verifyCommit,
} from '../src/index.js'

// cids of `{ text: 'hello' }` and `{ text: 'world' }`
const CID_A = parseCid(
  'bafyreidefdycgbfy3oglcb6ism3eqhyp5llsrpzxjsuac2gsy4mtrtx244',
)
const CID_B = parseCid(
  'bafyreidpw4cbv6gr4ukh33z23pvvrpr3wi4gnpmi4doamlsl3sa4rgri2a',
)

const ctx: CommitCtx = {
  space: 'at://did:example:space/space/app.bsky.group/test',
  author: 'did:example:alice',
  rev: '3kbcq3p7ad400',
}

describe('RepoCommit', () => {
  let keypair: Keypair

  beforeAll(async () => {
    keypair = await Secp256k1Keypair.create()
  })

  const sameContents = (a: RepoCommit, b: RepoCommit) =>
    a.setHash.equals(b.setHash)

  describe('contents', () => {
    it('starts empty', () => {
      expect(new RepoCommit().setHash.isEmpty()).toBe(true)
      expect(new RepoCommit().setHash.state()).toHaveLength(LTHASH_STATE_BYTES)
    })

    it('add then remove returns to empty', () => {
      const repo = new RepoCommit().add('c.a', '1', CID_A)
      expect(repo.setHash.isEmpty()).toBe(false)
      repo.remove('c.a', '1', CID_A)
      expect(repo.setHash.isEmpty()).toBe(true)
    })

    it('is order-independent', () => {
      const a = new RepoCommit().add('c.a', '1', CID_A).add('c.b', '2', CID_B)
      const b = new RepoCommit().add('c.b', '2', CID_B).add('c.a', '1', CID_A)
      expect(sameContents(a, b)).toBe(true)
    })

    it('distinguishes the same cid at different paths', () => {
      const a = new RepoCommit().add('c.a', '1', CID_A)
      const b = new RepoCommit().add('c.a', '2', CID_A)
      expect(sameContents(a, b)).toBe(false)
    })

    it('distinguishes different cids at the same path', () => {
      const a = new RepoCommit().add('c.a', '1', CID_A)
      const b = new RepoCommit().add('c.a', '1', CID_B)
      expect(sameContents(a, b)).toBe(false)
    })

    it('round-trips through persisted state', () => {
      const repo = new RepoCommit().add('c.a', '1', CID_A)
      const resumed = RepoCommit.fromState(repo.setHash.state())
      expect(sameContents(resumed, repo)).toBe(true)
      expect(RepoCommit.fromState(null).setHash.isEmpty()).toBe(true)
    })

    it('fromRecords matches incremental adds', () => {
      const records = [
        { collection: 'c.a', rkey: '1', cid: CID_A },
        { collection: 'c.b', rkey: '2', cid: CID_B },
      ]
      const incremental = new RepoCommit()
      for (const r of records) incremental.add(r.collection, r.rkey, r.cid)
      expect(sameContents(RepoCommit.fromRecords(records), incremental)).toBe(
        true,
      )
    })
  })

  describe('applyOp', () => {
    it('treats a null prev as a create', () => {
      const viaOp = new RepoCommit().applyOp({
        collection: 'c.a',
        rkey: '1',
        cid: CID_A,
        prev: null,
      })
      expect(sameContents(viaOp, new RepoCommit().add('c.a', '1', CID_A))).toBe(
        true,
      )
    })

    it('treats a null cid as a delete', () => {
      const repo = new RepoCommit().add('c.a', '1', CID_A)
      repo.applyOp({ collection: 'c.a', rkey: '1', cid: null, prev: CID_A })
      expect(repo.setHash.isEmpty()).toBe(true)
    })

    it('swaps both cids on an update', () => {
      const repo = new RepoCommit().add('c.a', '1', CID_A)
      repo.applyOp({ collection: 'c.a', rkey: '1', cid: CID_B, prev: CID_A })
      expect(sameContents(repo, new RepoCommit().add('c.a', '1', CID_B))).toBe(
        true,
      )
    })

    it('applyOps replays a batch', () => {
      const repo = new RepoCommit().applyOps([
        { collection: 'c.a', rkey: '1', cid: CID_A, prev: null },
        { collection: 'c.a', rkey: '1', cid: CID_B, prev: CID_A },
        { collection: 'c.a', rkey: '1', cid: null, prev: CID_B },
      ])
      expect(repo.setHash.isEmpty()).toBe(true)
    })

    it('converges regardless of the order ops are applied', () => {
      const ops = [
        { collection: 'c.a', rkey: '1', cid: CID_A, prev: null },
        { collection: 'c.b', rkey: '2', cid: CID_B, prev: null },
      ]
      const forward = new RepoCommit().applyOps(ops)
      const backward = new RepoCommit().applyOps([...ops].reverse())
      expect(sameContents(forward, backward)).toBe(true)
    })
  })

  describe('signing', () => {
    let repo: RepoCommit

    beforeAll(() => {
      repo = new RepoCommit().add('app.bsky.feed.post', '1', CID_A)
    })

    it('produces a well-formed commit', async () => {
      const commit = await repo.sign(ctx, keypair)
      expect(commit.ver).toBe(1)
      expect(commit.rev).toBe(ctx.rev)
      expect(commit.hash).toEqual(repo.setHash.digest())
      expect(commit.hash).toHaveLength(32)
      expect(commit.ikm).toHaveLength(32)
      expect(commit.mac).toHaveLength(32)
      expect(commit.sig.length).toBeGreaterThan(0)
    })

    it('verifies its own commit', async () => {
      const commit = await repo.sign(ctx, keypair)
      expect(await verifyCommit(commit, ctx, keypair.did())).toBe(true)
      expect(repo.matches(commit)).toBe(true)
    })

    it('uses a fresh ikm per commit, for deniability', async () => {
      const a = await repo.sign(ctx, keypair)
      const b = await repo.sign(ctx, keypair)
      expect(a.ikm).not.toEqual(b.ikm)
      expect(a.mac).not.toEqual(b.mac)
      expect(a.sig).not.toEqual(b.sig)
      expect(a.hash).toEqual(b.hash)
    })

    it('rejects a signature from a different key', async () => {
      const other = await Secp256k1Keypair.create()
      const commit = await repo.sign(ctx, keypair)
      expect(await verifyCommit(commit, ctx, other.did())).toBe(false)
    })

    it.each([
      ['space', { space: 'at://did:example:space/space/app.bsky.group/other' }],
      ['author', { author: 'did:example:bob' }],
      ['rev', { rev: '3kbcq3p7ad999' }],
    ])('does not verify under a different %s', async (_field, override) => {
      const commit = await repo.sign(ctx, keypair)
      const otherCtx = { ...ctx, ...override }
      expect(await verifyCommit(commit, otherCtx, keypair.did())).toBe(false)
    })

    it('does not verify a tampered hash', async () => {
      const commit = await repo.sign(ctx, keypair)
      const tampered = { ...commit, hash: new RepoCommit().setHash.digest() }
      // The signature over the ctx is still valid — it never covered the hash.
      // The MAC is what catches this, and what a leaked commit can't prove.
      expect(await verifyCommit(tampered, ctx, keypair.did())).toBe(false)
    })

    it('rejects a commit whose rev disagrees with the ctx', async () => {
      const commit = await repo.sign(ctx, keypair)
      expect(
        await verifyCommit(
          { ...commit, rev: '3kbcq3p7ad999' },
          ctx,
          keypair.did(),
        ),
      ).toBe(false)
    })

    it('rejects an unknown commit version', async () => {
      const commit = await repo.sign(ctx, keypair)
      const future = { ...commit, ver: 2 } as unknown as SignedCommit
      expect(await verifyCommit(future, ctx, keypair.did())).toBe(false)
    })

    it('matches() is false once the repo changes', async () => {
      const commit = await repo.sign(ctx, keypair)
      const advanced = RepoCommit.fromState(repo.setHash.state()).add(
        'app.bsky.feed.post',
        '2',
        CID_B,
      )
      expect(advanced.matches(commit)).toBe(false)
    })
  })

  /**
   * The set hash element is a bare `collection/rkey/cid` concat. Two records
   * hashing to one element would let one's addition cancel the other's — silently
   * and permanently — so what keeps the encoding injective is worth stating.
   *
   * It is *not* the length prefixing that {@link encodeCommitCtx} uses. It rests
   * entirely on the outer two fields being slash-free: a collection is an NSID and
   * a cid is base32, so the first slash always ends the collection and the last
   * always begins the cid. That leaves the rkey unambiguous no matter what it
   * contains. This package validates none of that itself — the invariant is
   * inherited from the lexicon's `nsid` and `record-key` string formats.
   */
  describe('formatSetHashElement', () => {
    it('separates the three fields', () => {
      expect(formatSetHashElement('c.a', '1', CID_A)).toBe(
        `c.a/1/${CID_A.toString()}`,
      )
    })

    it('stays unambiguous for an rkey containing a slash', () => {
      // Not reachable through a validated write, but it shows the boundaries are
      // fixed by the outer fields rather than by the rkey's shape.
      const element = formatSetHashElement('c.a', 'b/1', CID_A)
      expect(element.slice(0, element.indexOf('/'))).toBe('c.a')
      expect(element.slice(element.lastIndexOf('/') + 1)).toBe(CID_A.toString())
    })

    it('distinguishes records that differ only in where the rkey starts', () => {
      expect(formatSetHashElement('c.a', 'b/1', CID_A)).not.toBe(
        formatSetHashElement('c.a', 'b/2', CID_A),
      )
      expect(new RepoCommit().add('c.a', 'b/1', CID_A).setHash).not.toEqual(
        new RepoCommit().add('c.a', 'b/2', CID_A).setHash,
      )
    })
  })

  describe('encodeCommitCtx', () => {
    const ikm = new Uint8Array(32).fill(7)

    it('is length-prefixed and domain-separated', () => {
      const encoded = encodeCommitCtx(ctx, ikm)
      expect(Buffer.from(encoded.subarray(0, 16)).toString()).toBe(
        'atproto-space-v1',
      )
      const spaceLen = (encoded[16] << 8) | encoded[17]
      expect(spaceLen).toBe(ctx.space.length)
    })

    it('is unambiguous across field boundaries', () => {
      // Without length prefixes these two would encode identically.
      const a = encodeCommitCtx({ space: 'ab', author: 'c', rev: 'd' }, ikm)
      const b = encodeCommitCtx({ space: 'a', author: 'bc', rev: 'd' }, ikm)
      expect(a).not.toEqual(b)
    })

    it('is deterministic', () => {
      expect(encodeCommitCtx(ctx, ikm)).toEqual(encodeCommitCtx(ctx, ikm))
    })
  })
})
