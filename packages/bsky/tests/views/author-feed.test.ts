import AtpAgent from '@atproto/api'
import { CloseFn, runTestEnv } from '@atproto/dev-env'
import {
  adminAuth,
  forSnapshot,
  paginateAll,
  processAll,
  stripViewerFromPost,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'

describe('pds author feed views', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    const testEnv = await runTestEnv({
      dbPostgresSchema: 'views_author_feed',
    })
    close = testEnv.close
    agent = new AtpAgent({ service: testEnv.bsky.url })
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await processAll(testEnv)
    await testEnv.bsky.ctx.labeler.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await close()
  })

  // @TODO(bsky) blocked by actor takedown via labels.
  // @TODO(bsky) blocked by record takedown via labels.

  it('fetches full author feeds for self (sorted, minimal viewer state).', async () => {
    const aliceForAlice = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(aliceForAlice.data.feed)).toMatchSnapshot()

    const bobForBob = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[bob].handle },
      { headers: sc.getHeaders(bob, true) },
    )

    expect(forSnapshot(bobForBob.data.feed)).toMatchSnapshot()

    const carolForCarol = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[carol].handle },
      { headers: sc.getHeaders(carol, true) },
    )

    expect(forSnapshot(carolForCarol.data.feed)).toMatchSnapshot()

    const danForDan = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[dan].handle },
      { headers: sc.getHeaders(dan, true) },
    )

    expect(forSnapshot(danForDan.data.feed)).toMatchSnapshot()
  })

  it("reflects fetching user's state in the feed.", async () => {
    const aliceForCarol = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(carol, true) },
    )

    aliceForCarol.data.feed.forEach((postView) => {
      const { viewer, uri } = postView.post
      expect(viewer?.like).toEqual(sc.likes[carol][uri]?.toString())
      expect(viewer?.repost).toEqual(sc.reposts[carol][uri]?.toString())
    })

    expect(forSnapshot(aliceForCarol.data.feed)).toMatchSnapshot()
  })

  it('paginates', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getAuthorFeed(
        {
          actor: sc.accounts[alice].handle,
          cursor,
          limit: 2,
        },
        { headers: sc.getHeaders(dan, true) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(dan, true) },
    )

    expect(full.data.feed.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches results unauthed.', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(alice, true) },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getAuthorFeed({
      actor: sc.accounts[alice].handle,
    })
    expect(unauthed.feed.length).toBeGreaterThan(0)
    expect(unauthed.feed).toEqual(
      authed.feed.map((item) => {
        const result = {
          ...item,
          post: stripViewerFromPost(item.post),
        }
        if (item.reply) {
          result.reply = {
            parent: stripViewerFromPost(item.reply.parent),
            root: stripViewerFromPost(item.reply.root),
          }
        }
        return result
      }),
    )
  })

  it('blocked by actor takedown.', async () => {
    const { data: preBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: sc.getHeaders(carol, true) },
    )

    expect(preBlock.feed.length).toBeGreaterThan(0)

    const { data: action } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: alice,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const { data: postBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: sc.getHeaders(carol, true) },
    )

    expect(postBlock.feed.length).toEqual(0)

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: action.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })

  it('blocked by record takedown.', async () => {
    const { data: preBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: sc.getHeaders(carol, true) },
    )

    expect(preBlock.feed.length).toBeGreaterThan(0)

    const post = preBlock.feed[0].post

    const { data: action } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.repo.strongRef',
            uri: post.uri,
            cid: post.cid,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const { data: postBlock } = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: alice },
      { headers: sc.getHeaders(carol, true) },
    )

    expect(postBlock.feed.length).toEqual(preBlock.feed.length - 1)
    expect(postBlock.feed.map((item) => item.post.uri)).not.toContain(post.uri)

    // Cleanup
    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: action.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })
})
