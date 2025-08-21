import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, likesSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { OutputSchema as GetLikesOutputSchema } from '../../src/lexicon/types/app/bsky/feed/getLikes'
import { constantDate, forSnapshot, paginateAll, stripViewer } from '../_util'

describe('pds like views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let frankie: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_likes',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await likesSeed(sc)
    await sc.createAccount('frankie', {
      handle: 'frankie.test',
      email: 'frankie@frankie.com',
      password: 'password',
    })
    await network.processAll()

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    frankie = sc.dids.frankie
  })

  afterAll(async () => {
    await network.close()
  })

  const getCursors = (items: { createdAt?: string }[]) =>
    items.map((item) => item.createdAt ?? constantDate)

  const getSortedCursors = (items: { createdAt?: string }[]) =>
    getCursors(items).sort((a, b) => tstamp(b) - tstamp(a))

  const tstamp = (x: string) => new Date(x).getTime()

  it('fetches post likes', async () => {
    const alicePost = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetLikes) },
    )

    expect(forSnapshot(alicePost.data)).toMatchSnapshot()
    expect(getCursors(alicePost.data.likes)).toEqual(
      getSortedCursors(alicePost.data.likes),
    )
  })

  it('fetches reply likes', async () => {
    const bobReply = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.replies[bob][0].ref.uriStr },
      { headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetLikes) },
    )

    expect(forSnapshot(bobReply.data)).toMatchSnapshot()
    expect(getCursors(bobReply.data.likes)).toEqual(
      getSortedCursors(bobReply.data.likes),
    )
  })

  it('paginates', async () => {
    const results = (results: GetLikesOutputSchema[]) =>
      results.flatMap((res) => res.likes)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getLikes(
        {
          uri: sc.posts[alice][1].ref.uriStr,
          cursor,
          limit: 2,
        },
        {
          headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetLikes),
        },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.likes.length).toBeLessThanOrEqual(2),
    )

    const full = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetLikes) },
    )

    expect(full.data.likes.length).toEqual(4)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })

  it('fetches post likes unauthed', async () => {
    const { data: authed } = await agent.api.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetLikes) },
    )
    const { data: unauthed } = await agent.api.app.bsky.feed.getLikes({
      uri: sc.posts[alice][1].ref.uriStr,
    })
    expect(unauthed.likes.length).toBeGreaterThan(0)
    expect(unauthed.likes).toEqual(
      authed.likes.map((like) => {
        return {
          ...like,
          actor: stripViewer(like.actor),
        }
      }),
    )
  })

  it(`author viewer doesn't see likes by user the author blocked`, async () => {
    await sc.like(frankie, sc.posts[alice][1].ref)
    await network.processAll()

    const beforeBlock = await agent.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetLikes) },
    )

    expect(beforeBlock.data.likes.map((like) => like.actor.did)).toStrictEqual([
      sc.dids.frankie,
      sc.dids.eve,
      sc.dids.dan,
      sc.dids.carol,
      sc.dids.bob,
    ])

    await sc.block(alice, frankie)
    await network.processAll()

    const afterBlock = await agent.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetLikes) },
    )

    expect(afterBlock.data.likes.map((like) => like.actor.did)).toStrictEqual([
      sc.dids.eve,
      sc.dids.dan,
      sc.dids.carol,
      sc.dids.bob,
    ])
  })

  it(`non-author viewer doesn't see likes by user the author blocked and by user the viewer blocked `, async () => {
    await sc.unblock(alice, frankie)
    await network.processAll()

    const beforeBlock = await agent.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: await network.serviceHeaders(bob, ids.AppBskyFeedGetLikes) },
    )

    expect(beforeBlock.data.likes.map((like) => like.actor.did)).toStrictEqual([
      sc.dids.frankie,
      sc.dids.eve,
      sc.dids.dan,
      sc.dids.carol,
      sc.dids.bob,
    ])

    await sc.block(alice, frankie)
    await sc.block(bob, carol)
    await network.processAll()

    const afterBlock = await agent.app.bsky.feed.getLikes(
      { uri: sc.posts[alice][1].ref.uriStr },
      { headers: await network.serviceHeaders(bob, ids.AppBskyFeedGetLikes) },
    )

    expect(afterBlock.data.likes.map((like) => like.actor.did)).toStrictEqual([
      sc.dids.eve,
      sc.dids.dan,
      sc.dids.bob,
    ])
  })
})
