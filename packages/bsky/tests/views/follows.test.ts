import AtpAgent from '@atproto/api'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  paginateAll,
  processAll,
} from '../_util'
import { SeedClient } from '../seeds/client'
import followsSeed from '../seeds/follows'

describe('pds follow views', () => {
  let agent: AtpAgent
  let close: CloseFn
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'views_follows',
    })
    close = server.close
    agent = new AtpAgent({ service: server.url })
    const pdsAgent = new AtpAgent({ service: server.pdsUrl })
    sc = new SeedClient(pdsAgent)
    await followsSeed(sc)
    await processAll(server)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  // TODO(bsky) blocks followers by actor takedown via labels
  // TODO(bsky) blocks follows by actor takedown via labels

  it('fetches followers', async () => {
    const aliceFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    const bobFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.bob },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()

    const carolFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.carol },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()

    const danFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.dan },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()

    const eveFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.eve },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
  })

  it('fetches followers by handle', async () => {
    const byDid = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice, true) },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.accounts[alice].handle },
      { headers: sc.getHeaders(alice, true) },
    )
    expect(byHandle.data).toEqual(byDid.data)
  })

  it('paginates followers', async () => {
    const results = (results) => results.flatMap((res) => res.followers)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.graph.getFollowers(
        {
          user: sc.dids.alice,
          before: cursor,
          limit: 2,
        },
        { headers: sc.getHeaders(alice, true) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.followers.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(full.data.followers.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches follows', async () => {
    const aliceFollowers = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    const bobFollowers = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.bob },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()

    const carolFollowers = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.carol },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()

    const danFollowers = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.dan },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()

    const eveFollowers = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.eve },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
  })

  it('fetches follows by handle', async () => {
    const byDid = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice, true) },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollows(
      { user: sc.accounts[alice].handle },
      { headers: sc.getHeaders(alice, true) },
    )
    expect(byHandle.data).toEqual(byDid.data)
  })

  it('paginates follows', async () => {
    const results = (results) => results.flatMap((res) => res.follows)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.graph.getFollows(
        {
          user: sc.dids.alice,
          before: cursor,
          limit: 2,
        },
        { headers: sc.getHeaders(alice, true) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.follows.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice, true) },
    )

    expect(full.data.follows.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
