import {
  AppBskyGraphGetFollowers,
  AppBskyGraphGetFollows,
  AtpAgent,
} from '@atproto/api'
import { SeedClient, TestNetwork, followsSeed } from '@atproto/dev-env'
import { forSnapshot, paginateAll, stripViewer } from '../_util'

describe('pds follow views', () => {
  let agent: AtpAgent
  let network: TestNetwork
  let sc: SeedClient

  // account dids, for convenience
  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_follows',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await followsSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  // TODO(bsky) blocks followers by actor takedown via labels
  // TODO(bsky) blocks follows by actor takedown via labels

  it('fetches followers', async () => {
    const aliceFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollowers',
        ),
      },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    const bobFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.bob },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollowers',
        ),
      },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()

    const carolFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.carol },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollowers',
        ),
      },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()

    const danFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.dan },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollowers',
        ),
      },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()

    const eveFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.eve },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollowers',
        ),
      },
    )

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
  })

  it('fetches followers by handle', async () => {
    const byDid = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollowers',
        ),
      },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.accounts[alice].handle },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollowers',
        ),
      },
    )
    expect(byHandle.data).toEqual(byDid.data)
  })

  it('paginates followers', async () => {
    const results = (results: AppBskyGraphGetFollowers.OutputSchema[]) =>
      results.flatMap((res) => res.followers)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.graph.getFollowers(
        {
          actor: sc.dids.alice,
          cursor,
          limit: 2,
        },
        {
          headers: await network.serviceHeaders(
            alice,
            'app.bsky.graph.getFollowers',
          ),
        },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.followers.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollowers',
        ),
      },
    )

    expect(full.data.followers.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches followers unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollowers',
        ),
      },
    )
    const { data: unauthed } = await agent.api.app.bsky.graph.getFollowers({
      actor: sc.dids.alice,
    })
    expect(unauthed.followers.length).toBeGreaterThan(0)
    expect(unauthed.followers).toEqual(authed.followers.map(stripViewer))
  })

  it('blocks followers by actor takedown', async () => {
    await network.bsky.ctx.dataplane.takedownActor({
      did: sc.dids.dan,
    })

    const aliceFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollowers',
        ),
      },
    )

    expect(aliceFollowers.data.followers.map((f) => f.did)).not.toContain(
      sc.dids.dan,
    )

    await network.bsky.ctx.dataplane.untakedownActor({
      did: sc.dids.dan,
    })
  })

  it('fetches follows', async () => {
    const aliceFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollows',
        ),
      },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    const bobFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.bob },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollows',
        ),
      },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()

    const carolFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.carol },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollows',
        ),
      },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()

    const danFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.dan },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollows',
        ),
      },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()

    const eveFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.eve },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollows',
        ),
      },
    )

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
  })

  it('fetches follows by handle', async () => {
    const byDid = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollows',
        ),
      },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.accounts[alice].handle },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollows',
        ),
      },
    )
    expect(byHandle.data).toEqual(byDid.data)
  })

  it('paginates follows', async () => {
    const results = (results: AppBskyGraphGetFollows.OutputSchema[]) =>
      results.flatMap((res) => res.follows)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.graph.getFollows(
        {
          actor: sc.dids.alice,
          cursor,
          limit: 2,
        },
        {
          headers: await network.serviceHeaders(
            alice,
            'app.bsky.graph.getFollows',
          ),
        },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.follows.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollows',
        ),
      },
    )

    expect(full.data.follows.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches follows unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollows',
        ),
      },
    )
    const { data: unauthed } = await agent.api.app.bsky.graph.getFollows({
      actor: sc.dids.alice,
    })
    expect(unauthed.follows.length).toBeGreaterThan(0)
    expect(unauthed.follows).toEqual(authed.follows.map(stripViewer))
  })

  it('blocks follows by actor takedown', async () => {
    await network.bsky.ctx.dataplane.takedownActor({
      did: sc.dids.dan,
    })

    const aliceFollows = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          'app.bsky.graph.getFollows',
        ),
      },
    )

    expect(aliceFollows.data.follows.map((f) => f.did)).not.toContain(
      sc.dids.dan,
    )

    await network.bsky.ctx.dataplane.untakedownActor({
      did: sc.dids.dan,
    })
  })

  it('fetches relationships between users', async () => {
    const res = await agent.api.app.bsky.graph.getRelationships({
      actor: sc.dids.bob,
      others: [sc.dids.alice, sc.dids.bob, sc.dids.carol],
    })
    expect(res.data.actor).toEqual(sc.dids.bob)
    expect(res.data.relationships.length).toBe(3)
    expect(forSnapshot(res.data)).toMatchSnapshot()
  })
})
