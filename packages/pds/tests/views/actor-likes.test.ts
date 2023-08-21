import AtpAgent, { AtUri } from '@atproto/api'
import { runTestServer, CloseFn } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

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

    await expect(
      agent.api.app.bsky.feed.getActorLikes(
        { actor: sc.accounts[bob].handle },
        { headers: sc.getHeaders(carol) },
      ),
    ).rejects.toThrow('Profile not found')
  })

  it('viewer has blocked author of liked post(s)', async () => {
    const bobBlocksAlice = await agent.api.app.bsky.graph.block.create(
      {
        repo: bob, // bob blocks alice
      },
      {
        subject: alice,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(bob),
    )

    const {
      data: { feed },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle },
      { headers: sc.getHeaders(bob) },
    )

    expect(
      feed.every((item) => {
        return item.post.author.did !== alice
      }),
    ).toBe(true)

    // unblock
    await agent.api.app.bsky.graph.block.delete(
      { repo: bob, rkey: new AtUri(bobBlocksAlice.uri).rkey },
      sc.getHeaders(bob),
    )
  })

  it('liked post author has blocked viewer', async () => {
    const aliceBlocksBob = await agent.api.app.bsky.graph.block.create(
      {
        repo: alice, // alice blocks bob
      },
      {
        subject: bob,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )

    const {
      data: { feed },
    } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle },
      { headers: sc.getHeaders(bob) },
    )

    expect(
      feed.every((item) => {
        return item.post.author.did !== alice
      }),
    ).toBe(true)

    // unblock
    await agent.api.app.bsky.graph.block.delete(
      { repo: alice, rkey: new AtUri(aliceBlocksBob.uri).rkey },
      sc.getHeaders(alice),
    )
  })

  it('viewer has muted author of liked post(s)', async () => {
    await agent.api.app.bsky.graph.muteActor(
      { actor: alice }, // bob mutes alice
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )

    const { data } = await agent.api.app.bsky.feed.getActorLikes(
      { actor: sc.accounts[bob].handle }, // bob has liked alice's posts
      { headers: sc.getHeaders(bob) },
    )

    expect(
      data.feed.every((item) => {
        return item.post.author.did !== alice
      }),
    ).toBe(true) // alice's posts are filtered out

    await agent.api.app.bsky.graph.unmuteActor(
      { actor: alice }, // dan unmutes alice
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
  })
})
