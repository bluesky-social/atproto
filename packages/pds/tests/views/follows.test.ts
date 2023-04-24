import AtpAgent from '@atproto/api'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import {
  runTestServer,
  forSnapshot,
  CloseFn,
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
    await server.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await close()
  })

  it('fetches followers', async () => {
    const aliceFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    const bobFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.bob },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()

    const carolFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.carol },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()

    const danFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()

    const eveFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.eve },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
  })

  it('fetches followers by handle', async () => {
    const byDid = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(alice) },
    )
    expect(byHandle.data).toEqual(byDid.data)
  })

  it('paginates followers', async () => {
    const results = (results) => results.flatMap((res) => res.followers)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.graph.getFollowers(
        {
          actor: sc.dids.alice,
          cursor,
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
      { actor: sc.dids.alice },
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
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.dan,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const aliceFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'did:example:admin',
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
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    const bobFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.bob },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()

    const carolFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.carol },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()

    const danFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.dan },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()

    const eveFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.eve },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(eveFollowers.data)).toMatchSnapshot()
  })

  it('fetches follows by handle', async () => {
    const byDid = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.accounts[alice].handle },
      { headers: sc.getHeaders(alice) },
    )
    expect(byHandle.data).toEqual(byDid.data)
  })

  it('paginates follows', async () => {
    const results = (results) => results.flatMap((res) => res.follows)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.graph.getFollows(
        {
          actor: sc.dids.alice,
          cursor,
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
      { actor: sc.dids.alice },
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
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.dan,
          },
          createdBy: 'did:example:admin',
          reason: 'Y',
        },
        {
          encoding: 'application/json',
          headers: { authorization: adminAuth() },
        },
      )

    const aliceFollows = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.alice },
      { headers: sc.getHeaders(alice) },
    )

    expect(forSnapshot(aliceFollows.data)).toMatchSnapshot()

    await agent.api.com.atproto.admin.reverseModerationAction(
      {
        id: modAction.id,
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: { authorization: adminAuth() },
      },
    )
  })
})
