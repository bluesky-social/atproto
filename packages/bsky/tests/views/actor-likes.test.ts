import AtpAgent, { AtUri } from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import {
  BlockedByActorError,
  BlockedActorError,
} from '@atproto/api/src/client/types/app/bsky/feed/getActorLikes'

describe('bsky actor likes feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_likes',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns posts liked by actor', async () => {
    const {
      data: { feed: bobLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(bobLikes).toHaveLength(3)

    const {
      data: { feed: carolLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[carol].handle },
      { headers: await network.serviceHeaders(carol) },
    )

    expect(carolLikes).toHaveLength(2)

    const {
      data: { feed: aliceLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[alice].handle },
      { headers: await network.serviceHeaders(alice) },
    )

    expect(aliceLikes).toHaveLength(1)

    const {
      data: { feed: danLikes },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[dan].handle },
      { headers: await network.serviceHeaders(dan) },
    )

    expect(danLikes).toHaveLength(1)
  })

  it('actor blocks viewer', async () => {
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

    try {
      await agent.api.app.bsky.feed.getActorLikes(
        { actor: sc.accounts[alice].handle },
        { headers: await network.serviceHeaders(bob) },
      )
    } catch (e) {
      expect(e).toBeInstanceOf(BlockedByActorError)
    }

    // unblock
    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: alice, rkey: new AtUri(aliceBlockBob.uri).rkey },
      sc.getHeaders(alice),
    )
  })

  it('viewer has blocked actor', async () => {
    const bobBlockAlice = await pdsAgent.api.app.bsky.graph.block.create(
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
        { headers: await network.serviceHeaders(bob) },
      )
    } catch (e) {
      expect(e).toBeInstanceOf(BlockedActorError)
    }

    // unblock
    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: bob, rkey: new AtUri(bobBlockAlice.uri).rkey },
      sc.getHeaders(bob),
    )
  })

  it('liked post(s) author(s) blocks viewer', async () => {
    const aliceBlockDan = await pdsAgent.api.app.bsky.graph.block.create(
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
      { headers: await network.serviceHeaders(dan) },
    )

    expect(
      data.feed.every((item) => {
        return item.post.author.did !== alice
      }),
    ).toBe(true) // alice's posts are filtered out

    // unblock
    await pdsAgent.api.app.bsky.graph.block.delete(
      { repo: alice, rkey: new AtUri(aliceBlockDan.uri).rkey },
      sc.getHeaders(alice),
    )
  })

  it('liked post(s) author(s) muted by viewer', async () => {
    await pdsAgent.api.app.bsky.graph.muteActor(
      { actor: alice }, // dan mutes alice
      { headers: sc.getHeaders(dan), encoding: 'application/json' },
    )

    const { data } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle }, // bob has liked alice's posts
      { headers: await network.serviceHeaders(dan) },
    )

    expect(
      data.feed.every((item) => {
        return item.post.author.did !== alice
      }),
    ).toBe(true) // alice's posts are filtered out

    await pdsAgent.api.app.bsky.graph.unmuteActor(
      { actor: alice }, // dan unmutes alice
      { headers: sc.getHeaders(dan), encoding: 'application/json' },
    )
  })
})
