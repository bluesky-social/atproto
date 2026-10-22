import { beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from '@atproto/crypto'
import { type Cid, parseCid } from '@atproto/lex-data'
import {
  type Commit,
  type CommitCtx,
  LTHASH_STATE_BYTES,
  type RecordPathParts,
  RepoCommit,
  type RepoOp,
  computeCommitMac,
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
  repo: 'did:example:alice',
  rev: '3kbcq3p7ad400',
}

describe('RepoCommit', () => {
  const sameContents = (a: RepoCommit, b: RepoCommit) =>
    a.setHash.equals(b.setHash)

  describe('contents', () => {
    it('starts empty', () => {
      expect(new RepoCommit().setHash.isEmpty()).toBe(true)
      expect(new RepoCommit().setHash.state()).toHaveLength(LTHASH_STATE_BYTES)
    })

    it('add then remove returns to empty', () => {
      const repo = new RepoCommit().add('n.c.a', '1', CID_A)
      expect(repo.setHash.isEmpty()).toBe(false)
      repo.remove('n.c.a', '1', CID_A)
      expect(repo.setHash.isEmpty()).toBe(true)
    })

    it('is order-independent', () => {
      const a = new RepoCommit()
        .add('n.c.a', '1', CID_A)
        .add('n.c.b', '2', CID_B)
      const b = new RepoCommit()
        .add('n.c.b', '2', CID_B)
        .add('n.c.a', '1', CID_A)
      expect(sameContents(a, b)).toBe(true)
    })

    it('distinguishes the same cid at different paths', () => {
      const a = new RepoCommit().add('n.c.a', '1', CID_A)
      const b = new RepoCommit().add('n.c.a', '2', CID_A)
      expect(sameContents(a, b)).toBe(false)
    })

    it('distinguishes different cids at the same path', () => {
      const a = new RepoCommit().add('n.c.a', '1', CID_A)
      const b = new RepoCommit().add('n.c.a', '1', CID_B)
      expect(sameContents(a, b)).toBe(false)
    })

    it('round-trips through persisted state', () => {
      const repo = new RepoCommit().add('n.c.a', '1', CID_A)
      const resumed = RepoCommit.fromState(repo.setHash.state())
      expect(sameContents(resumed, repo)).toBe(true)
      expect(RepoCommit.fromState(null).setHash.isEmpty()).toBe(true)
    })

    it('fromRecords matches incremental adds', () => {
      const records: (RecordPathParts & { cid: Cid })[] = [
        { collection: 'n.c.a', rkey: '1', cid: CID_A },
        { collection: 'n.c.b', rkey: '2', cid: CID_B },
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
        collection: 'n.c.a',
        rkey: '1',
        cid: CID_A,
        prev: null,
      })
      expect(
        sameContents(viaOp, new RepoCommit().add('n.c.a', '1', CID_A)),
      ).toBe(true)
    })

    it('treats a null cid as a delete', () => {
      const repo = new RepoCommit().add('n.c.a', '1', CID_A)
      repo.applyOp({ collection: 'n.c.a', rkey: '1', cid: null, prev: CID_A })
      expect(repo.setHash.isEmpty()).toBe(true)
    })

    it('swaps both cids on an update', () => {
      const repo = new RepoCommit().add('n.c.a', '1', CID_A)
      repo.applyOp({ collection: 'n.c.a', rkey: '1', cid: CID_B, prev: CID_A })
      expect(
        sameContents(repo, new RepoCommit().add('n.c.a', '1', CID_B)),
      ).toBe(true)
    })

    it('applyOps replays a batch', () => {
      const repo = new RepoCommit().applyOps([
        { collection: 'n.c.a', rkey: '1', cid: CID_A, prev: null },
        { collection: 'n.c.a', rkey: '1', cid: CID_B, prev: CID_A },
        { collection: 'n.c.a', rkey: '1', cid: null, prev: CID_B },
      ])
      expect(repo.setHash.isEmpty()).toBe(true)
    })

    it('converges regardless of the order ops are applied', () => {
      const ops: RepoOp[] = [
        { collection: 'n.c.a', rkey: '1', cid: CID_A, prev: null },
        { collection: 'n.c.b', rkey: '2', cid: CID_B, prev: null },
      ]
      const forward = new RepoCommit().applyOps(ops)
      const backward = new RepoCommit().applyOps([...ops].reverse())
      expect(sameContents(forward, backward)).toBe(true)
    })
  })

  describe('commits', () => {
    let repo: RepoCommit
    const sharedSecret = randomBytes(32)

    beforeAll(() => {
      repo = new RepoCommit().add('app.bsky.feed.post', '1', CID_A)
    })

    const verifyParams = (mac: Uint8Array) => ({
      space: ctx.space,
      repo: ctx.repo,
      sharedSecret,
      mac,
    })

    it('produces a well-formed commit', () => {
      const commit = repo.toCommit(ctx)
      expect(commit.ver).toBe(1)
      expect(commit.repo).toBe(ctx.repo)
      expect(commit.space).toBe(ctx.space)
      expect(commit.rev).toBe(ctx.rev)
      expect(commit.data).toEqual(repo.setHash.digest())
      expect(commit.data).toHaveLength(32)
    })

    it('verifies a commit against its MAC', () => {
      const commit = repo.toCommit(ctx)
      const mac = computeCommitMac(sharedSecret, commit)
      expect(verifyCommit(commit, verifyParams(mac))).toBe(true)
      expect(repo.matches(commit)).toBe(true)
    })

    it('rejects a MAC under a different shared secret', () => {
      const commit = repo.toCommit(ctx)
      const mac = computeCommitMac(randomBytes(32), commit)
      expect(verifyCommit(commit, verifyParams(mac))).toBe(false)
    })

    it.each<[string, Partial<Commit>]>([
      ['space', { space: 'at://did:example:space/space/app.bsky.group/other' }],
      ['repo', { repo: 'did:example:bob' }],
    ])('rejects a commit for a different %s', (_field, override) => {
      const commit = repo.toCommit(ctx)
      const mac = computeCommitMac(sharedSecret, commit)
      expect(verifyCommit(commit, { ...verifyParams(mac), ...override })).toBe(
        false,
      )
    })

    it.each<[string, Partial<Commit>]>([
      ['space', { space: 'at://did:example:space/space/app.bsky.group/other' }],
      ['repo', { repo: 'did:example:bob' }],
      ['rev', { rev: '3kbcq3p7ad999' }],
      ['data', { data: new RepoCommit().setHash.digest() }],
    ])('rejects a tampered %s', (_field, override) => {
      const commit = repo.toCommit(ctx)
      const mac = computeCommitMac(sharedSecret, commit)
      const tampered = { ...commit, ...override }
      // Point the request at the tampered fields so only the MAC can catch it.
      const params = {
        ...verifyParams(mac),
        space: tampered.space,
        repo: tampered.repo,
      }
      expect(verifyCommit(tampered, params)).toBe(false)
    })

    it('rejects an unknown commit version', () => {
      const commit = { ...repo.toCommit(ctx), ver: 2 }
      const mac = computeCommitMac(sharedSecret, commit)
      expect(verifyCommit(commit, verifyParams(mac))).toBe(false)
    })

    it('matches() is false once the repo changes', () => {
      const commit = repo.toCommit(ctx)
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
   * It is *not* the length prefixing that {@link computeCommitMac} uses. It rests
   * entirely on the outer two fields being slash-free: a collection is an NSID and
   * a cid is base32, so the first slash always ends the collection and the last
   * always begins the cid. That leaves the rkey unambiguous no matter what it
   * contains. This package validates none of that itself — the invariant is
   * inherited from the lexicon's `nsid` and `record-key` string formats.
   */
  describe('formatSetHashElement', () => {
    it('separates the three fields', () => {
      expect(formatSetHashElement('n.c.a', '1', CID_A)).toBe(
        `n.c.a/1/${CID_A.toString()}`,
      )
    })

    it('stays unambiguous for an rkey containing a slash', () => {
      // Not reachable through a validated write, but it shows the boundaries are
      // fixed by the outer fields rather than by the rkey's shape.
      const element = formatSetHashElement('n.c.a', 'b/1', CID_A)
      expect(element.slice(0, element.indexOf('/'))).toBe('n.c.a')
      expect(element.slice(element.lastIndexOf('/') + 1)).toBe(CID_A.toString())
    })

    it('distinguishes records that differ only in where the rkey starts', () => {
      expect(formatSetHashElement('n.c.a', 'b/1', CID_A)).not.toBe(
        formatSetHashElement('n.c.a', 'b/2', CID_A),
      )
      expect(new RepoCommit().add('n.c.a', 'b/1', CID_A).setHash).not.toEqual(
        new RepoCommit().add('n.c.a', 'b/2', CID_A).setHash,
      )
    })
  })
})
