import { AtUri, AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

describe('bsky actor likes feed views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_actor_likes',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
  })

  afterAll(async () => {
    await network.close()
  })

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
