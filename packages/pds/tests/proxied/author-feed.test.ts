import AtpAgent from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { forSnapshot, paginateAll } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds author feed proxy views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_author_feed',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    await network.pds.ctx.labeler.processAll()
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('fetches full author feeds for self (sorted, minimal viewer state).', async () => {
    const aliceForAlice = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      {
        headers: sc.getHeaders(alice),
      },
    )

    expect(forSnapshot(aliceForAlice.data.feed)).toMatchSnapshot()

    const bobForBob = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[bob].handle },
      {
        headers: sc.getHeaders(bob),
      },
    )

    expect(forSnapshot(bobForBob.data.feed)).toMatchSnapshot()

    const carolForCarol = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[carol].handle },
      {
        headers: sc.getHeaders(carol),
      },
    )

    expect(forSnapshot(carolForCarol.data.feed)).toMatchSnapshot()

    const danForDan = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[dan].handle },
      {
        headers: sc.getHeaders(dan),
      },
    )

    expect(forSnapshot(danForDan.data.feed)).toMatchSnapshot()
  })

  it("reflects fetching user's state in the feed.", async () => {
    const aliceForCarol = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[alice].handle },
      {
        headers: sc.getHeaders(carol),
      },
    )

    aliceForCarol.data.feed.forEach((postView) => {
      const { viewer, uri } = postView.post
      expect(viewer?.like).toEqual(sc.likes[carol]?.[uri]?.toString())
      expect(viewer?.repost).toEqual(sc.reposts[carol][uri]?.toString())
    })

    expect(forSnapshot(aliceForCarol.data.feed)).toMatchSnapshot()
  })

  it('omits reposts from muted users.', async () => {
    await agent.api.app.bsky.graph.muteActor(
      { actor: alice }, // Has a repost by dan: will be omitted from dan's feed
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    await agent.api.app.bsky.graph.muteActor(
      { actor: dan }, // Feed author: their posts will still appear
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    const bobForDan = await agent.api.app.bsky.feed.getAuthorFeed(
      { actor: sc.accounts[dan].handle },
      { headers: sc.getHeaders(bob) },
    )

    expect(forSnapshot(bobForDan.data.feed)).toMatchSnapshot()

    await agent.api.app.bsky.graph.unmuteActor(
      { actor: alice },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
    await agent.api.app.bsky.graph.unmuteActor(
      { actor: dan },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )
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
        { headers: sc.getHeaders(dan) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getAuthorFeed(
      {
        actor: sc.accounts[alice].handle,
      },
      { headers: sc.getHeaders(dan) },
    )

    expect(full.data.feed.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
