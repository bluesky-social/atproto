import { AtUri, AtpAgent } from '@atproto/api'
import { Handler as SkeletonHandler } from '@atproto/pds/src/lexicon/types/app/bsky/feed/getFeedSkeleton'
import { UnknownFeedError } from '@atproto/api/src/client/types/app/bsky/feed/getFeed'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { TestFeedGen } from '@atproto/dev-env/src/feed-gen'
import { TID } from '@atproto/common'
import { forSnapshot, paginateAll } from './_util'
import {
  FeedViewPost,
  GeneratorView,
} from '@atproto/api/src/client/types/app/bsky/feed/defs'
import { SkeletonFeedPost } from '../src/lexicon/types/app/bsky/feed/defs'
import { RecordRef } from './seeds/client'
import { ids } from '../src/lexicon/lexicons'

describe('feed generation', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let gen: TestFeedGen

  let alice: string
  let feedUriAll: string
  let feedUriAllRef: RecordRef
  let feedUriEven: string
  let feedUriOdd: string // Unsupported by feed gen

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'feed_generation',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await network.pds.ctx.backgroundQueue.processAll()
    alice = sc.dids.alice
    const allUri = AtUri.make(alice, 'app.bsky.feed.generator', 'all')
    const evenUri = AtUri.make(alice, 'app.bsky.feed.generator', 'even')
    gen = await network.createFeedGen({
      [allUri.toString()]: feedGenHandler('all'),
      [evenUri.toString()]: feedGenHandler('even'),
    })
  })

  afterAll(async () => {
    await network.close()
  })

  it('describes the feed generator', async () => {
    const res = await agent.api.app.bsky.feed.describeFeedGenerator()
    expect(res.data.did).toBe(network.pds.ctx.cfg.feedGenDid)
  })

  it('feed gen records can be created.', async () => {
    const all = await agent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'all' },
      {
        did: gen.did,
        displayName: 'All',
        description: 'Provides all feed candidates',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    const even = await agent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'even' },
      {
        did: gen.did,
        displayName: 'Even',
        description: 'Provides even-indexed feed candidates',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    // Unsupported by feed gen
    const odd = await agent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'odd' },
      {
        did: gen.did,
        displayName: 'Temp', // updated in next test
        description: 'Temp', // updated in next test
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    feedUriAll = all.uri
    feedUriAllRef = new RecordRef(all.uri, all.cid)
    feedUriEven = even.uri
    feedUriOdd = odd.uri
  })

  it('feed gen records can be updated', async () => {
    await agent.api.com.atproto.repo.putRecord(
      {
        repo: alice,
        collection: ids.AppBskyFeedGenerator,
        rkey: 'odd',
        record: {
          did: gen.did,
          displayName: 'Odd',
          description: 'Provides odd-indexed feed candidates',
          createdAt: new Date().toISOString(),
        },
      },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
  })

  it('getActorFeeds fetches feed generators by actor.', async () => {
    // add some likes
    await sc.like(sc.dids.bob, feedUriAllRef)
    await sc.like(sc.dids.carol, feedUriAllRef)

    const results = (results) => results.flatMap((res) => res.feeds)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getActorFeeds(
        { actor: alice, cursor, limit: 2 },
        { headers: sc.getHeaders(sc.dids.bob) },
      )
      return res.data
    }

    const paginatedAll: GeneratorView[] = results(await paginateAll(paginator))

    expect(paginatedAll.length).toEqual(3)
    expect(paginatedAll[0].uri).toEqual(feedUriOdd)
    expect(paginatedAll[1].uri).toEqual(feedUriEven)
    expect(paginatedAll[2].uri).toEqual(feedUriAll)
    expect(forSnapshot(paginatedAll)).toMatchSnapshot()
  })

  it('embeds feed generator records in posts', async () => {
    const res = await agent.api.app.bsky.feed.post.create(
      { repo: sc.dids.bob },
      {
        text: 'cool feed!',
        embed: {
          $type: 'app.bsky.embed.record',
          record: feedUriAllRef.raw,
        },
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.bob),
    )
    const view = await agent.api.app.bsky.feed.getPosts(
      { uris: [res.uri] },
      { headers: sc.getHeaders(sc.dids.bob) },
    )
    expect(view.data.posts.length).toBe(1)
    expect(forSnapshot(view.data.posts[0])).toMatchSnapshot()
  })

  describe('getFeedGenerator', () => {
    it('describes a feed gen & returns online status', async () => {
      const resEven = await agent.api.app.bsky.feed.getFeedGenerator(
        { feed: feedUriAll },
        { headers: sc.getHeaders(sc.dids.bob) },
      )
      expect(forSnapshot(resEven.data)).toMatchSnapshot()
      expect(resEven.data.isOnline).toBe(true)
      expect(resEven.data.isValid).toBe(true)
    })

    it('handles an unsupported algo', async () => {
      const resOdd = await agent.api.app.bsky.feed.getFeedGenerator(
        { feed: feedUriOdd },
        { headers: sc.getHeaders(sc.dids.bob) },
      )
      expect(resOdd.data.isOnline).toBe(true)
      expect(resOdd.data.isValid).toBe(false)
    })

    it('handles an offline feed', async () => {
      // make an invalid feed gen in bob's repo
      const allUriBob = AtUri.make(
        sc.dids.bob,
        'app.bsky.feed.generator',
        'all',
      )
      const bobFg = await network.createFeedGen({
        [allUriBob.toString()]: feedGenHandler('all'),
      })

      await agent.api.app.bsky.feed.generator.create(
        { repo: sc.dids.bob, rkey: 'all' },
        {
          did: bobFg.did,
          displayName: 'All by bob',
          description: 'Provides all feed candidates - by bob',
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(sc.dids.bob),
      )

      // now take it offline
      await bobFg.close()

      const res = await agent.api.app.bsky.feed.getFeedGenerator(
        {
          feed: allUriBob.toString(),
        },
        { headers: sc.getHeaders(sc.dids.alice) },
      )
      expect(res.data.isOnline).toBe(false)
      expect(res.data.isValid).toBe(false)
    })
  })

  describe('getFeedGenerators', () => {
    it('describes multiple feed gens', async () => {
      const resEven = await agent.api.app.bsky.feed.getFeedGenerators(
        { feeds: [feedUriEven, feedUriAll] },
        { headers: sc.getHeaders(sc.dids.bob) },
      )
      expect(forSnapshot(resEven.data)).toMatchSnapshot()
    })
  })

  describe('getPopularFeedGenerators', () => {
    it('gets popular feed generators', async () => {
      const resEven =
        await agent.api.app.bsky.unspecced.getPopularFeedGenerators(
          {},
          { headers: sc.getHeaders(sc.dids.bob) },
        )
      expect(resEven.data.feeds.map((f) => f.likeCount)).toEqual([2, 0, 0, 0])
    })
  })

  describe('getFeed', () => {
    it('resolves basic feed contents.', async () => {
      const feed = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: sc.getHeaders(alice) },
      )
      expect(feed.data.feed.map((item) => item.post.uri)).toEqual([
        sc.posts[sc.dids.alice][0].ref.uriStr,
        sc.posts[sc.dids.carol][0].ref.uriStr,
        sc.replies[sc.dids.carol][0].ref.uriStr,
      ])
      expect(forSnapshot(feed.data.feed)).toMatchSnapshot()
    })

    it('paginates, handling replies and reposts.', async () => {
      const results = (results) => results.flatMap((res) => res.feed)
      const paginator = async (cursor?: string) => {
        const res = await agent.api.app.bsky.feed.getFeed(
          { feed: feedUriAll, cursor, limit: 2 },
          { headers: sc.getHeaders(alice) },
        )
        return res.data
      }

      const paginatedAll: FeedViewPost[] = results(await paginateAll(paginator))

      // Unknown post uri is omitted
      expect(paginatedAll.map((item) => item.post.uri)).toEqual([
        sc.posts[sc.dids.alice][0].ref.uriStr,
        sc.posts[sc.dids.bob][0].ref.uriStr,
        sc.posts[sc.dids.carol][0].ref.uriStr,
        sc.replies[sc.dids.carol][0].ref.uriStr,
        sc.posts[sc.dids.dan][1].ref.uriStr,
      ])
      expect(forSnapshot(paginatedAll)).toMatchSnapshot()
    })

    it('fails on unknown feed.', async () => {
      const tryGetFeed = agent.api.app.bsky.feed.getFeed(
        { feed: feedUriOdd },
        { headers: sc.getHeaders(alice) },
      )
      await expect(tryGetFeed).rejects.toThrow(UnknownFeedError)
    })

    it('receives proper auth details.', async () => {
      const feed = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: sc.getHeaders(alice) },
      )
      expect(feed.data['$auth']?.['aud']).toEqual(gen.did)
      expect(feed.data['$auth']?.['iss']).toEqual(alice)
    })

    it('receives proper auth details.', async () => {
      const feed = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: sc.getHeaders(alice) },
      )
      expect(feed.data['$auth']?.['aud']).toEqual(gen.did)
      expect(feed.data['$auth']?.['iss']).toEqual(alice)
    })

    it('provides timing info in server-timing header.', async () => {
      const result = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: sc.getHeaders(alice) },
      )
      expect(result.headers['server-timing']).toMatch(
        /^skele;dur=\d+, hydr;dur=\d+$/,
      )
    })

    it('returns an upstream failure error when the feed is down.', async () => {
      await gen.close() // @NOTE must be last test
      const tryGetFeed = agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: sc.getHeaders(alice) },
      )
      await expect(tryGetFeed).rejects.toThrow('feed unavailable')
    })
  })

  const feedGenHandler =
    (feedName: 'even' | 'all'): SkeletonHandler =>
    async ({ req, params }) => {
      const { limit, cursor } = params
      const candidates: SkeletonFeedPost[] = [
        { post: sc.posts[sc.dids.alice][0].ref.uriStr },
        { post: sc.posts[sc.dids.bob][0].ref.uriStr },
        { post: sc.posts[sc.dids.carol][0].ref.uriStr },
        { post: `at://did:plc:unknown/app.bsky.feed.post/${TID.nextStr()}` }, // Doesn't exist
        { post: sc.replies[sc.dids.carol][0].ref.uriStr }, // Reply
        // Repost (accurate)
        {
          post: sc.posts[sc.dids.dan][1].ref.uriStr,
          reason: {
            $type: 'app.bsky.feed.defs#skeletonReasonRepost',
            repost: sc.reposts[sc.dids.carol][0].uriStr,
          },
        },
        // Repost (inaccurate)
        {
          post: sc.posts[alice][1].ref.uriStr,
          reason: {
            $type: 'app.bsky.feed.defs#skeletonReasonRepost',
            repost: sc.reposts[sc.dids.carol][0].uriStr,
          },
        },
      ]
      const offset = cursor ? parseInt(cursor, 10) : 0
      const fullFeed = candidates.filter((_, i) =>
        feedName === 'even' ? i % 2 === 0 : true,
      )
      const feedResults = fullFeed.slice(offset, offset + limit)
      const lastResult = feedResults.at(-1)
      return {
        encoding: 'application/json',
        body: {
          feed: feedResults,
          cursor: lastResult
            ? (fullFeed.indexOf(lastResult) + 1).toString()
            : undefined,
          $auth: jwtBody(req.headers.authorization), // for testing purposes
        },
      }
    }
})

const jwtBody = (authHeader?: string): Record<string, unknown> | undefined => {
  if (!authHeader?.startsWith('Bearer')) return undefined
  const jwt = authHeader.replace('Bearer ', '')
  const [, bodyb64] = jwt.split('.')
  const body = JSON.parse(Buffer.from(bodyb64, 'base64').toString())
  if (!body || typeof body !== 'object') return undefined
  return body
}
