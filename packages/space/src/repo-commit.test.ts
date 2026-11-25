import { describe, expect, it } from 'vitest'
import { P256Keypair, randomBytes } from '@atproto/crypto'
import { parseCid } from '@atproto/lex-data'
import type { DidString } from '@atproto/syntax'
import { decapsulate, encapsulate } from './kem.js'
import { LtHash } from './lthash.js'
import {
  COMMIT_MAC_PROFILE,
  type VerifyMacParams,
  createCommitMacHeaders,
  formatMacRequest,
  parseMacRequest,
} from './mac.js'
import { RepoCommit, verifyCommit } from './repo-commit.js'
import type { CommitCtx, SpaceCommit } from './types.js'

// cids of `{ text: 'hello' }` and `{ text: 'world' }`
const CID_A = parseCid(
  'bafyreidefdycgbfy3oglcb6ism3eqhyp5llsrpzxjsuac2gsy4mtrtx244',
)
const CID_B = parseCid(
  'bafyreidpw4cbv6gr4ukh33z23pvvrpr3wi4gnpmi4doamlsl3sa4rgri2a',
)

const ctx: CommitCtx = {
  space: 'at:space/did:example:space/app.bsky.group/test',
  repo: 'did:example:alice',
  rev: '3kbcq3p7ad400',
}

const sameContents = (a: RepoCommit, b: RepoCommit) =>
  a.setHash.equals(b.setHash)

// What a syncer verifies `commit` with, after the host MACs it under the secret
// they share.
async function macFor(commit: SpaceCommit): Promise<VerifyMacParams> {
  const kemKey = await P256Keypair.create()
  const { keyShare, sharedSecret } = await encapsulate(
    kemKey.did() as DidString,
  )
  const request = parseMacRequest(
    formatMacRequest(COMMIT_MAC_PROFILE, keyShare),
    COMMIT_MAC_PROFILE,
  )!
  const { headers } = createCommitMacHeaders(commit, {
    ...request,
    sharedSecret: decapsulate(kemKey, keyShare),
  })
  return { keyShare, sharedSecret, headers: new Headers(headers) }
}

const commit = new RepoCommit().add('n.c.a', '1', CID_A).toCommit(ctx)
const mac = await macFor(commit)

describe(RepoCommit, () => {
  it('hashes each record as a collection/rkey/cid element', () => {
    const repo = new RepoCommit()
      .add('app.bsky.feed.post', '1', CID_A)
      .add('app.bsky.feed.like', '2', CID_B)
    const expected = new LtHash()
      .add(`app.bsky.feed.post/1/${CID_A.toString()}`)
      .add(`app.bsky.feed.like/2/${CID_B.toString()}`)
    expect(repo.setHash.equals(expected)).toBe(true)
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

  it('builds from records as from incremental adds', () => {
    const fromRecords = RepoCommit.fromRecords([
      { collection: 'n.c.a', rkey: '1', cid: CID_A },
      { collection: 'n.c.b', rkey: '2', cid: CID_B },
    ])
    const incremental = new RepoCommit()
      .add('n.c.a', '1', CID_A)
      .add('n.c.b', '2', CID_B)
    expect(sameContents(fromRecords, incremental)).toBe(true)
  })

  it('resumes from persisted state, and from nullish state as empty', () => {
    const repo = new RepoCommit().add('n.c.a', '1', CID_A)
    expect(sameContents(RepoCommit.fromState(repo.setHash.state()), repo)).toBe(
      true,
    )
    expect(RepoCommit.fromState(null).setHash.isEmpty()).toBe(true)
  })

  describe('applyOp', () => {
    it('treats a null prev as a create', () => {
      const repo = new RepoCommit().applyOp({
        collection: 'n.c.a',
        rkey: '1',
        cid: CID_A,
        prev: null,
      })
      expect(
        sameContents(repo, new RepoCommit().add('n.c.a', '1', CID_A)),
      ).toBe(true)
    })

    it('treats a null cid as a delete', () => {
      const repo = new RepoCommit().add('n.c.a', '1', CID_A)
      repo.applyOp({ collection: 'n.c.a', rkey: '1', cid: null, prev: CID_A })
      expect(repo.setHash.isEmpty()).toBe(true)
    })

    it('swaps the cids on an update', () => {
      const repo = new RepoCommit().add('n.c.a', '1', CID_A)
      repo.applyOp({ collection: 'n.c.a', rkey: '1', cid: CID_B, prev: CID_A })
      expect(
        sameContents(repo, new RepoCommit().add('n.c.a', '1', CID_B)),
      ).toBe(true)
    })

    it('replays a batch with applyOps', () => {
      const repo = new RepoCommit().applyOps([
        { collection: 'n.c.a', rkey: '1', cid: CID_A, prev: null },
        { collection: 'n.c.a', rkey: '1', cid: CID_B, prev: CID_A },
        { collection: 'n.c.a', rkey: '1', cid: null, prev: CID_B },
      ])
      expect(repo.setHash.isEmpty()).toBe(true)
    })
  })

  it('builds a commit over its current contents', () => {
    const repo = new RepoCommit().add('n.c.a', '1', CID_A)
    expect(repo.toCommit(ctx)).toEqual({
      ver: 1,
      ...ctx,
      data: repo.setHash.digest(),
    })
  })

  it('matches only the commit of its current contents', () => {
    const repo = new RepoCommit().add('n.c.a', '1', CID_A)
    const commit = repo.toCommit(ctx)
    expect(repo.matches(commit)).toBe(true)
    expect(repo.add('n.c.a', '2', CID_B).matches(commit)).toBe(false)
  })
})

describe(verifyCommit, () => {
  it('accepts a commit under its MAC', () => {
    expect(() => verifyCommit(commit, { ...ctx, ...mac })).not.toThrow()
  })

  it('rejects a commit whose MAC does not match', () => {
    expect(() =>
      verifyCommit(commit, { ...ctx, ...mac, sharedSecret: randomBytes(32) }),
    ).toThrow(/MAC does not match/)
  })

  it.each([
    {
      note: 'space',
      request: { space: 'at:space/did:example:space/app.bsky.group/other' },
      message: /commit is for another space/,
    },
    {
      note: 'repo',
      request: { repo: 'did:example:bob' },
      message: /commit is for another repo/,
    },
  ] as const)('rejects a commit for another $note', ({ request, message }) => {
    expect(() => verifyCommit(commit, { ...ctx, ...mac, ...request })).toThrow(
      message,
    )
  })

  it('rejects an unknown commit version', () => {
    expect(() =>
      verifyCommit({ ...commit, ver: 2 }, { ...ctx, ...mac }),
    ).toThrow(/unsupported commit version: 2/)
  })
})
