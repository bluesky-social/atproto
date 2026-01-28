import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { Client, DidString } from '@atproto/lex'
import { app, com } from '@atproto/pds'

describe('bsky account deactivation', () => {
  let network: TestNetwork
  let client: Client
  let sc: SeedClient

  let alice: DidString

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_account_deactivation',
    })
    client = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    const pdsClient = network.pds.getClient()
    await pdsClient.call(
      com.atproto.server.deactivateAccount,
      {},
      { headers: sc.getHeaders(alice) },
    )
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('does not return deactivated profiles', async () => {
    const attempt = client.call(app.bsky.actor.getProfile, {
      actor: alice,
    })
    await expect(attempt).rejects.toThrow('Account is deactivated')
    const res = await client.call(app.bsky.actor.getProfiles, {
      actors: [sc.dids.alice, sc.dids.bob, sc.dids.carol],
    })
    expect(res.profiles.length).toBe(2)
    expect(res.profiles.some((p) => p.did === alice)).toBe(false)
  })

  it('does not return deactivated accounts in follows', async () => {
    const follows = await client.call(app.bsky.graph.getFollows, {
      actor: sc.dids.bob,
    })
    expect(follows.follows.some((f) => f.did === alice)).toBe(false)
    const followers = await client.call(app.bsky.graph.getFollowers, {
      actor: sc.dids.bob,
    })
    expect(followers.followers.some((f) => f.did === alice)).toBe(false)
  })

  it('does not return posts from deactivated accounts', async () => {
    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][1].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      sc.posts[sc.dids.carol][0].ref.uriStr,
      sc.posts[sc.dids.dan][1].ref.uriStr,
      sc.replies[sc.dids.alice][0].ref.uriStr,
    ]
    const res = await client.call(app.bsky.feed.getPosts, { uris })

    expect(res.posts.length).toBe(3)
    expect(res.posts.some((p) => p.author.did === alice)).toBe(false)
  })

  it('does not return posts from deactivated in timelines', async () => {
    const res = await client.call(
      app.bsky.feed.getTimeline,
      {},
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          app.bsky.feed.getTimeline.$lxm,
        ),
      },
    )
    expect(res.feed.some((p) => p.post.author.did === alice)).toBe(false)
  })
})
