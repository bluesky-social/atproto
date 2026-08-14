import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type AppBskyFeedGetRepostedBy, type AtpAgent, ids } from '@atproto/api'
import { type SeedClient, TestNetwork, repostsSeed } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { forSnapshot, paginateAll, stripViewer } from '../_util.js'

describe('pds repost views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: DidString
  let bob: DidString

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_reposts',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await repostsSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  it('fetches reposted-by for a post', async () => {
    const view = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetRepostedBy,
        ),
      },
    )
    expect(view.data.uri).toEqual(sc.posts[sc.dids.alice][2].ref.uriStr)
    expect(forSnapshot(view.data.repostedBy)).toMatchSnapshot()
  })

  it('fetches reposted-by for a reply', async () => {
    const view = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.replies[bob][0].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetRepostedBy,
        ),
      },
    )
    expect(view.data.uri).toEqual(sc.replies[sc.dids.bob][0].ref.uriStr)
    expect(forSnapshot(view.data.repostedBy)).toMatchSnapshot()
  })

  it('paginates', async () => {
    const results = (results: AppBskyFeedGetRepostedBy.OutputSchema[]) =>
      results.flatMap((res) => res.repostedBy)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getRepostedBy(
        {
          uri: sc.posts[alice][2].ref.uriStr,
          cursor,
          limit: 2,
        },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetRepostedBy,
          ),
        },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.repostedBy.length).toBeLessThanOrEqual(2),
    )
    expect(paginatedAll[0].cursor).toBeDefined()
    expect(paginatedAll.at(-1)?.cursor).toBeUndefined()

    const full = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetRepostedBy,
        ),
      },
    )

    expect(full.data.repostedBy.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))

    const exact = await network.bsky.ctx.dataplane.getRepostsBySubject({
      subject: { uri: sc.posts[alice][2].ref.uriStr },
      limit: 4,
    })
    const nonterminal = await network.bsky.ctx.dataplane.getRepostsBySubject({
      subject: { uri: sc.posts[alice][2].ref.uriStr },
      limit: 2,
    })
    expect(exact.uris).toHaveLength(4)
    expect(exact.cursor).toBe('')
    expect(nonterminal.uris).toHaveLength(2)
    expect(nonterminal.cursor).not.toBe('')

    const actorReposts = await network.bsky.ctx.dataplane.getActorReposts({
      actorDid: sc.dids.dan,
      limit: 4,
    })
    const actorRepostsNonterminal =
      await network.bsky.ctx.dataplane.getActorReposts({
        actorDid: sc.dids.dan,
        limit: 2,
      })
    expect(actorReposts.uris).toHaveLength(4)
    expect(actorReposts.cursor).toBe('')
    expect(actorRepostsNonterminal.uris).toHaveLength(2)
    expect(actorRepostsNonterminal.cursor).not.toBe('')
  })

  it('fills a limited reposted-by page after an entirely filtered page', async () => {
    const subject = await sc.post(alice, 'repost page fill subject')
    await sc.repost(bob, subject.ref, {
      createdAt: '2030-05-01T00:00:00.000Z',
    })
    await sc.repost(sc.dids.carol, subject.ref, {
      createdAt: '2030-05-02T00:00:00.000Z',
    })
    await sc.repost(sc.dids.dan, subject.ref, {
      createdAt: '2030-05-03T00:00:00.000Z',
    })
    await sc.repost(sc.dids.eve, subject.ref, {
      createdAt: '2030-05-04T00:00:00.000Z',
    })
    await sc.block(sc.dids.dan, alice)
    await sc.block(sc.dids.eve, alice)
    await network.processAll()

    const { data } = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: subject.ref.uriStr, limit: 2 },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetRepostedBy,
        ),
      },
    )

    expect(data.repostedBy.map((actor) => actor.did)).toEqual([
      sc.dids.carol,
      bob,
    ])
    expect(data.cursor).toBeUndefined()

    await sc.unblock(sc.dids.dan, alice)
    await sc.unblock(sc.dids.eve, alice)
  })

  it('fetches reposted-by unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getRepostedBy(
      { uri: sc.posts[alice][2].ref.uriStr },
      {
        headers: await network.serviceHeaders(
          alice,
          ids.AppBskyFeedGetRepostedBy,
        ),
      },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getRepostedBy({
      uri: sc.posts[alice][2].ref.uriStr,
    })
    expect(unauthed.repostedBy.length).toBeGreaterThan(0)
    expect(unauthed.repostedBy).toEqual(authed.repostedBy.map(stripViewer))
  })
})
