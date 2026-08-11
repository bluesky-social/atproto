import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AtUri, type AtpAgent, ids } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'

describe('bsky actor likes feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: DidString
  let bob: DidString
  let carol: DidString

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_likes',
    })
    agent = network.bsky.getAgent()
    pdsAgent = network.pds.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  it('returns posts liked by actor', async () => {
    const {
      data: { feed: bobLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetActorLikes,
        ),
      },
    )

    expect(bobLikes).toHaveLength(3)

    await expect(
      agent.api.app.bsky.feed.getActorLikes(
        { actor: sc.accounts[bob].handle },
        {
          headers: await network.serviceHeaders(
            carol,
            ids.AppBskyFeedGetActorLikes,
          ),
        },
      ),
    ).rejects.toThrow('Profile not found')
  })

  it('paginates actor likes and omits the terminal cursor', async () => {
    const headers = await network.serviceHeaders(
      bob,
      ids.AppBskyFeedGetActorLikes,
    )
    const first = await agent.api.app.bsky.feed.getActorLikes(
      { actor: bob, limit: 2 },
      { headers },
    )
    const second = await agent.api.app.bsky.feed.getActorLikes(
      { actor: bob, limit: 2, cursor: first.data.cursor },
      { headers },
    )

    expect(first.data.feed).toHaveLength(2)
    expect(first.data.cursor).toBeDefined()
    expect(second.data.feed).toHaveLength(1)
    expect(second.data.cursor).toBeUndefined()

    const exact = await network.bsky.ctx.dataplane.getActorLikes({
      actorDid: bob,
      limit: 3,
    })
    const nonterminal = await network.bsky.ctx.dataplane.getActorLikes({
      actorDid: bob,
      limit: 2,
    })
    expect(exact.likes).toHaveLength(3)
    expect(exact.cursor).toBe('')
    expect(nonterminal.likes).toHaveLength(2)
    expect(nonterminal.cursor).not.toBe('')
  })

  it('viewer has blocked author of liked post(s)', async () => {
    const olderVisible = await sc.post(carol, 'older visible liked post')
    await sc.like(bob, olderVisible.ref, {
      createdAt: '2000-01-01T00:00:00.000Z',
    })
    const bobBlocksAlice = await pdsAgent.api.app.bsky.graph.block.create(
      {
        repo: bob, // bob blocks alice
      },
      {
        subject: alice,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(bob),
    )

    await network.processAll()

    const {
      data: { feed },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle, limit: 2 },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetActorLikes,
        ),
      },
    )

    expect(feed).toHaveLength(2)
    expect(feed.every((item) => item.post.author.did === carol)).toBe(true)

    // unblock
    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: bob, rkey: new AtUri(bobBlocksAlice.uri).rkey },
      sc.getHeaders(bob),
    )
  })

  it('liked post author has blocked viewer', async () => {
    const aliceBlockBob = await pdsAgent.api.app.bsky.graph.block.create(
      {
        repo: alice, // alice blocks bob
      },
      {
        subject: bob,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )

    await network.processAll()

    const {
      data: { feed },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle },
      {
        headers: await network.serviceHeaders(
          bob,
          ids.AppBskyFeedGetActorLikes,
        ),
      },
    )

    expect(
      feed.every((item) => {
        return item.post.author.did !== alice
      }),
    ).toBe(true)

    // unblock
    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: alice, rkey: new AtUri(aliceBlockBob.uri).rkey },
      sc.getHeaders(alice),
    )
  })
})
