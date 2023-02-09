import AtpAgent from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/moderationAction'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
  constantDate,
  paginateAll,
  adminAuth,
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
    sc = new SeedClient(agent)
    await followsSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  const getCursors = (items: { createdAt?: string }[]) =>
    items.map((item) => item.createdAt ?? constantDate)

  const getSortedCursors = (items: { createdAt?: string }[]) =>
    getCursors(items).sort((a, b) => tstamp(b) - tstamp(a))

  const tstamp = (x: string) => new Date(x).getTime()

  it('fetches followers', async () => {
    const aliceFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()
    expect(getCursors(aliceFollowers.data.followers)).toEqual(
      getSortedCursors(aliceFollowers.data.followers),
    )

    const bobFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.bob },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()
    expect(getCursors(bobFollowers.data.followers)).toEqual(
      getSortedCursors(bobFollowers.data.followers),
    )

    const carolFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.carol },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()
    expect(getCursors(carolFollowers.data.followers)).toEqual(
      getSortedCursors(carolFollowers.data.followers),
    )

    const danFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.dan },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()
    expect(getCursors(danFollowers.data.followers)).toEqual(
      getSortedCursors(danFollowers.data.followers),
    )

    const eveFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.eve },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
    expect(getCursors(eveFollowers.data.followers)).toEqual(
      getSortedCursors(eveFollowers.data.followers),
    )
  })

  it('fetches followers by handle', async () => {
    const byDid = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.accounts[alice].handle },
      { headers: sc.getHeaders(alice) },
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
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.followers.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(full.data.followers.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('blocks followers by actor takedown', async () => {
    const { data: modAction } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.repo.repoRef',
            did: sc.dids.dan,
          },
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const aliceFollowers = await agent.api.app.bsky.graph.getFollowers(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'X',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })

  it('fetches follows', async () => {
    const aliceFollowers = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()
    expect(getCursors(aliceFollowers.data.follows)).toEqual(
      getSortedCursors(aliceFollowers.data.follows),
    )

    const bobFollowers = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.bob },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()
    expect(getCursors(bobFollowers.data.follows)).toEqual(
      getSortedCursors(bobFollowers.data.follows),
    )

    const carolFollowers = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.carol },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()
    expect(getCursors(carolFollowers.data.follows)).toEqual(
      getSortedCursors(carolFollowers.data.follows),
    )

    const danFollowers = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.dan },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()
    expect(getCursors(danFollowers.data.follows)).toEqual(
      getSortedCursors(danFollowers.data.follows),
    )

    const eveFollowers = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.eve },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
    expect(getCursors(eveFollowers.data.follows)).toEqual(
      getSortedCursors(eveFollowers.data.follows),
    )
  })

  it('fetches follows by handle', async () => {
    const byDid = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollows(
      { user: sc.accounts[alice].handle },
      { headers: sc.getHeaders(alice) },
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
        { headers: sc.getHeaders(alice) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.follows.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(full.data.follows.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('blocks follows by actor takedown', async () => {
    const { data: modAction } =
      await agent.api.com.atproto.admin.takeModerationAction(
        {
          action: TAKEDOWN,
          subject: {
            $type: 'com.atproto.repo.repoRef',
            did: sc.dids.dan,
          },
          createdBy: 'X',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const aliceFollows = await agent.api.app.bsky.graph.getFollows(
      { user: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceFollows.data)).toMatchSnapshot()

    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'X',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })
})
