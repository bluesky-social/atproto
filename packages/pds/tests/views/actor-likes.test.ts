import AtpAgent from '@atproto/api'
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
})
