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

    await expect(
      agent.api.app.bsky.feed.getActorLikes(
        { actor: sc.accounts[bob].handle },
        { headers: await network.serviceHeaders(carol) },
      ),
    ).rejects.toThrow('Likes are private')
  })

  it('viewer has blocked author of liked post(s)', async () => {
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
      { actor: sc.accounts[bob].handle },
      { headers: await network.serviceHeaders(bob) },
    )

    expect(
      feed.every((item) => {
        return item.post.author.did !== alice
      }),
    ).toBe(true)

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
      { headers: await network.serviceHeaders(bob) },
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

  it('viewer has muted author of liked post(s)', async () => {
    await pdsAgent.api.app.bsky.graph.muteActor(
      { actor: alice }, // bob mutes alice
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )

    await network.processAll()

    const { data } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle }, // bob has liked alice's posts
      { headers: await network.serviceHeaders(bob) },
    )

    expect(
      data.feed.every((item) => {
        return item.post.author.did !== alice
      }),
    ).toBe(true) // alice's posts are filtered out

    await pdsAgent.api.app.bsky.graph.unmuteActor(
      { actor: alice }, // dan unmutes alice
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
  })
})
