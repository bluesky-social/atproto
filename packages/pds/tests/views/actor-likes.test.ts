import AtpAgent, { AtUri } from '@atproto/api'
import { runTestServer, CloseFn } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import {
  BlockedByActorError,
  BlockedActorError,
} from '@atproto/api/src/client/types/app/bsky/feed/getActorLikes'

describe('pds actor likes feed views', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'pds_views_actor_likes',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    await server.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it('returns posts liked by actor', async () => {
    const {
      data: { feed: bobLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle },
      { headers: sc.getHeaders(bob) },
    )

    expect(bobLikes).toHaveLength(3)

    const {
      data: { feed: carolLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[carol].handle },
      { headers: sc.getHeaders(carol) },
    )

    expect(carolLikes).toHaveLength(2)

    const {
      data: { feed: aliceLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(alice) },
    )

    expect(aliceLikes).toHaveLength(1)

    const {
      data: { feed: danLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[dan].handle },
      { headers: sc.getHeaders(dan) },
    )

    expect(danLikes).toHaveLength(1)
  })

  it('actor blocks viewer', async () => {
    const aliceBlockBob = await agent.api.app.bsky.graph.block.create(
      {
        repo: alice, // alice blocks bob
      },
      {
        subject: bob,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )

    try {
      await agent.api.app.bsky.feed.getActorLikes(
        { actor: sc.accounts[alice].handle },
        { headers: sc.getHeaders(bob) },
      )
    } catch (e) {
      expect(e).toBeInstanceOf(BlockedByActorError)
    }

    // unblock
    await agent.api.app.bsky.graph.block.delete(
      { repo: alice, rkey: new AtUri(aliceBlockBob.uri).rkey },
      sc.getHeaders(alice),
    )
  })

  it('viewer has blocked actor', async () => {
    const bobBlockAlice = await agent.api.app.bsky.graph.block.create(
      {
        repo: bob, // alice blocks bob
      },
      {
        subject: alice,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(bob),
    )

    try {
      await agent.api.app.bsky.feed.getActorLikes(
        { actor: sc.accounts[alice].handle },
        { headers: sc.getHeaders(bob) },
      )
    } catch (e) {
      expect(e).toBeInstanceOf(BlockedActorError)
    }

    // unblock
    await agent.api.app.bsky.graph.block.delete(
      { repo: bob, rkey: new AtUri(bobBlockAlice.uri).rkey },
      sc.getHeaders(bob),
    )
  })

  it('liked post(s) author(s) blocks viewer', async () => {
    const aliceBlockDan = await agent.api.app.bsky.graph.block.create(
      {
        repo: alice, // alice blocks dan
      },
      {
        subject: dan,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )

    const { data } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle }, // bob has liked alice's posts
      { headers: sc.getHeaders(dan) },
    )

    expect(
      data.feed.every((item) => {
        return item.post.author.did !== alice
      }),
    ).toBe(true) // alice's posts are filtered out

    // unblock
    await agent.api.app.bsky.graph.block.delete(
      { repo: alice, rkey: new AtUri(aliceBlockDan.uri).rkey },
      sc.getHeaders(alice),
    )
  })

  it('liked post(s) author(s) muted by viewer', async () => {
    await agent.api.app.bsky.graph.muteActor(
      { actor: alice }, // dan mutes alice
      { headers: sc.getHeaders(dan), encoding: 'application/json' },
    )

    const { data } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle }, // bob has liked alice's posts
      { headers: sc.getHeaders(dan) },
    )

    expect(
      data.feed.every((item) => {
        return item.post.author.did !== alice
      }),
    ).toBe(true) // alice's posts are filtered out

    await agent.api.app.bsky.graph.unmuteActor(
      { actor: alice }, // dan unmutes alice
      { headers: sc.getHeaders(dan), encoding: 'application/json' },
    )
  })
})
