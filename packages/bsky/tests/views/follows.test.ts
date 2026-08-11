import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  type AppBskyGraphGetFollowers,
  type AppBskyGraphGetFollows,
  type AtpAgent,
  ids,
} from '@atproto/api'
import { type SeedClient, TestNetwork, followsSeed } from '@atproto/dev-env'
import { forSnapshot, paginateAll, stripViewer } from '../_util.js'

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
    alice = sc.dids.alice
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  // TODO(bsky) blocks followers by actor takedown via labels
  // TODO(bsky) blocks follows by actor takedown via labels

  it('fetches followers', async () => {
    const aliceFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollowers,
        ),
      },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    const bobFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.bob },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollowers,
        ),
      },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()

    const carolFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.carol },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollowers,
        ),
      },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()

    const danFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.dan },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollowers,
        ),
      },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()

    const eveFollowers = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.eve },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollowers,
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
          ids.AppBskyGraphGetFollowers,
        ),
      },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.accounts[alice].handle },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollowers,
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
            ids.AppBskyGraphGetFollowers,
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
          ids.AppBskyGraphGetFollowers,
        ),
      },
    )

    expect(full.data.followers.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fills a page after filtering followers', async () => {
    const subject = await sc.createAccount('page-fill-subject', {
      handle: 'fill-sub.test',
      email: 'page-fill-subject@example.com',
      password: 'hunter2',
    })
    const olderVisible = await sc.createAccount('page-fill-visible-older', {
      handle: 'fill-old.test',
      email: 'page-fill-visible-older@example.com',
      password: 'hunter2',
    })
    const newerVisible = await sc.createAccount('page-fill-visible-newer', {
      handle: 'fill-new.test',
      email: 'page-fill-visible-newer@example.com',
      password: 'hunter2',
    })
    const takenDown = await sc.createAccount('page-fill-taken-down', {
      handle: 'fill-down.test',
      email: 'page-fill-taken-down@example.com',
      password: 'hunter2',
    })
    const blocked = await sc.createAccount('page-fill-blocked', {
      handle: 'fill-block.test',
      email: 'page-fill-blocked@example.com',
      password: 'hunter2',
    })

    await sc.follow(olderVisible.did, subject.did, {
      createdAt: '2025-01-01T00:00:00.000Z',
    })
    await sc.follow(newerVisible.did, subject.did, {
      createdAt: '2025-01-02T00:00:00.000Z',
    })
    await sc.follow(takenDown.did, subject.did, {
      createdAt: '2025-01-03T00:00:00.000Z',
    })
    await sc.follow(blocked.did, subject.did, {
      createdAt: '2025-01-04T00:00:00.000Z',
    })
    await sc.block(subject.did, blocked.did)
    await network.processAll()
    await network.bsky.ctx.dataplane.takedownActor({ did: takenDown.did })

    const res = await agent.api.app.bsky.graph.getFollowers(
      { actor: subject.did, limit: 2 },
      {
        headers: await network.serviceHeaders(
          subject.did,
          ids.AppBskyGraphGetFollowers,
        ),
      },
    )

    expect(res.data.followers.map((follower) => follower.did)).toEqual([
      newerVisible.did,
      olderVisible.did,
    ])
  })

  it('fetches followers unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.graph.getFollowers(
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollowers,
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
          ids.AppBskyGraphGetFollowers,
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
          ids.AppBskyGraphGetFollows,
        ),
      },
    )

    expect(forSnapshot(aliceFollowers.data)).toMatchSnapshot()

    const bobFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.bob },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollows,
        ),
      },
    )

    expect(forSnapshot(bobFollowers.data)).toMatchSnapshot()

    const carolFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.carol },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollows,
        ),
      },
    )

    expect(forSnapshot(carolFollowers.data)).toMatchSnapshot()

    const danFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.dan },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollows,
        ),
      },
    )

    expect(forSnapshot(danFollowers.data)).toMatchSnapshot()

    const eveFollowers = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.dids.eve },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollows,
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
          ids.AppBskyGraphGetFollows,
        ),
      },
    )
    const byHandle = await agent.api.app.bsky.graph.getFollows(
      { actor: sc.accounts[alice].handle },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyGraphGetFollows,
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
            ids.AppBskyGraphGetFollows,
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
          ids.AppBskyGraphGetFollows,
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
          ids.AppBskyGraphGetFollows,
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
          ids.AppBskyGraphGetFollows,
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
