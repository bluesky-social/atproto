import { TID } from '@atproto/common'
import { AtUri, AtpAgent } from '@atproto/api'
import { TestNetwork } from '@atproto/dev-env'
import { TestFeedGen } from '@atproto/dev-env/src/feed-gen'
import { Handler as SkeletonHandler } from '@atproto/bsky/src/lexicon/types/app/bsky/feed/getFeedSkeleton'
import { GeneratorView } from '@atproto/api/src/client/types/app/bsky/feed/defs'
import { UnknownFeedError } from '@atproto/api/src/client/types/app/bsky/feed/getFeed'
import { TAKEDOWN } from '@atproto/api/src/client/types/com/atproto/admin/defs'
import { ids } from '../src/lexicon/lexicons'
import {
  FeedViewPost,
  SkeletonFeedPost,
} from '../src/lexicon/types/app/bsky/feed/defs'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { RecordRef } from './seeds/client'
import { forSnapshot, paginateAll } from './_util'

describe('feed generation', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let gen: TestFeedGen

  let alice: string
  let feedUriAll: string
  let feedUriAllRef: RecordRef
  let feedUriEven: string
  let feedUriOdd: string // Unsupported by feed gen
  let feedUriBadPagination: string
  let feedUriPrime: string // Taken-down
  let feedUriPrimeRef: RecordRef

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_feed_generation',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await network.processAll()
    await network.bsky.ctx.backgroundQueue.processAll()
    alice = sc.dids.alice
    const allUri = AtUri.make(alice, 'app.bsky.feed.generator', 'all')
    const feedUriBadPagination = AtUri.make(
      alice,
      'app.bsky.feed.generator',
      'bad-pagination',
    )
    const evenUri = AtUri.make(alice, 'app.bsky.feed.generator', 'even')
    const primeUri = AtUri.make(alice, 'app.bsky.feed.generator', 'prime')
    gen = await network.createFeedGen({
      [allUri.toString()]: feedGenHandler('all'),
      [evenUri.toString()]: feedGenHandler('even'),
      [feedUriBadPagination.toString()]: feedGenHandler('bad-pagination'),
      [primeUri.toString()]: feedGenHandler('prime'),
    })
  })

  afterAll(async () => {
    await gen.close()
    await network.close()
  })

  // @TODO enable once getFeed is implemented
  it('describes the feed generator', async () => {
    const res = await agent.api.app.bsky.feed.describeFeedGenerator()
    expect(res.data.did).toBe(network.bsky.ctx.cfg.feedGenDid)
  })

  it('feed gen records can be created.', async () => {
    const all = await pdsAgent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'all' },
      {
        did: gen.did,
        displayName: 'All',
        description: 'Provides all feed candidates',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    const even = await pdsAgent.api.app.bsky.feed.generator.create(
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
    const odd = await pdsAgent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'odd' },
      {
        did: gen.did,
        displayName: 'Temp', // updated in next test
        description: 'Temp', // updated in next test
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    const badPagination = await pdsAgent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'bad-pagination' },
      {
        did: gen.did,
        displayName: 'Bad Pagination',
        description:
          'Provides all feed candidates, blindly ignoring pagination limit',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    // Taken-down
    const prime = await pdsAgent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'prime' },
      {
        did: gen.did,
        displayName: 'Prime',
        description: 'Provides prime-indexed feed candidates',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    await network.processAll()
    await agent.api.com.atproto.admin.takeModerationAction(
      {
        action: TAKEDOWN,
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: prime.uri,
          cid: prime.cid,
        },
        createdBy: 'did:example:admin',
        reason: 'Y',
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    feedUriAll = all.uri
    feedUriAllRef = new RecordRef(all.uri, all.cid)
    feedUriEven = even.uri
    feedUriOdd = odd.uri
    feedUriBadPagination = badPagination.uri
    feedUriPrime = prime.uri
    feedUriPrimeRef = new RecordRef(prime.uri, prime.cid)
  })

  it('feed gen records can be updated', async () => {
    await pdsAgent.api.com.atproto.repo.putRecord(
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
    await network.processAll()
    await network.bsky.ctx.backgroundQueue.processAll()
  })

  it('getActorFeeds fetches feed generators by actor.', async () => {
    // add some likes
    await sc.like(sc.dids.bob, feedUriAllRef)
    await sc.like(sc.dids.carol, feedUriAllRef)
    await network.processAll()
    await network.bsky.ctx.backgroundQueue.processAll()

    const results = (results) => results.flatMap((res) => res.feeds)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getActorFeeds(
        { actor: alice, cursor, limit: 2 },
        { headers: await network.serviceHeaders(sc.dids.bob) },
      )
      return res.data
    }

    const paginatedAll: GeneratorView[] = results(await paginateAll(paginator))

    expect(paginatedAll.length).toEqual(4)
    expect(paginatedAll[0].uri).toEqual(feedUriOdd)
    expect(paginatedAll[1].uri).toEqual(feedUriBadPagination)
    expect(paginatedAll[2].uri).toEqual(feedUriEven)
    expect(paginatedAll[3].uri).toEqual(feedUriAll)
    expect(paginatedAll.map((fg) => fg.uri)).not.toContain(feedUriPrime) // taken-down
    expect(forSnapshot(paginatedAll)).toMatchSnapshot()
  })

  it('embeds feed generator records in posts', async () => {
    const res = await pdsAgent.api.app.bsky.feed.post.create(
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
    await network.processAll()
    await network.bsky.ctx.backgroundQueue.processAll()
    const view = await agent.api.app.bsky.feed.getPosts(
      { uris: [res.uri] },
      { headers: await network.serviceHeaders(sc.dids.bob) },
    )
    expect(view.data.posts.length).toBe(1)
    expect(forSnapshot(view.data.posts[0])).toMatchSnapshot()
  })

  it('does not embed taken-down feed generator records in posts', async () => {
    const res = await pdsAgent.api.app.bsky.feed.post.create(
      { repo: sc.dids.bob },
      {
        text: 'weird feed',
        embed: {
          $type: 'app.bsky.embed.record',
          record: feedUriPrimeRef.raw,
        },
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.bob),
    )
    await network.processAll()
    const view = await agent.api.app.bsky.feed.getPosts(
      { uris: [res.uri] },
      { headers: await network.serviceHeaders(sc.dids.bob) },
    )
    expect(view.data.posts.length).toBe(1)
    expect(forSnapshot(view.data.posts[0])).toMatchSnapshot()
  })

  describe('getFeedGenerator', () => {
    it('describes a feed gen & returns online status', async () => {
      const resEven = await agent.api.app.bsky.feed.getFeedGenerator(
        { feed: feedUriAll },
        { headers: await network.serviceHeaders(sc.dids.bob) },
      )
      expect(forSnapshot(resEven.data)).toMatchSnapshot()
      expect(resEven.data.isOnline).toBe(true)
      expect(resEven.data.isValid).toBe(true)
    })

    it('does not describe taken-down feed', async () => {
      const tryGetFeed = agent.api.app.bsky.feed.getFeedGenerator(
        { feed: feedUriPrime },
        { headers: await network.serviceHeaders(sc.dids.bob) },
      )
      await expect(tryGetFeed).rejects.toThrow('could not find feed')
    })

    // @TODO temporarily skipping while external feedgens catch-up on describeFeedGenerator
    it.skip('handles an unsupported algo', async () => {
      const resOdd = await agent.api.app.bsky.feed.getFeedGenerator(
        { feed: feedUriOdd },
        { headers: await network.serviceHeaders(sc.dids.bob) },
      )
      expect(resOdd.data.isOnline).toBe(true)
      expect(resOdd.data.isValid).toBe(false)
    })

    // @TODO temporarily skipping while external feedgens catch-up on describeFeedGenerator
    it.skip('handles an offline feed', async () => {
      // make an invalid feed gen in bob's repo
      const allUriBob = AtUri.make(
        sc.dids.bob,
        'app.bsky.feed.generator',
        'all',
      )
      const bobFg = await network.createFeedGen({
        [allUriBob.toString()]: feedGenHandler('all'),
      })

      await pdsAgent.api.app.bsky.feed.generator.create(
        { repo: sc.dids.bob, rkey: 'all' },
        {
          did: bobFg.did,
          displayName: 'All by bob',
          description: 'Provides all feed candidates - by bob',
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(sc.dids.bob),
      )
      await network.processAll()
      await network.bsky.ctx.backgroundQueue.processAll()

      // now take it offline
      await bobFg.close()

      const res = await agent.api.app.bsky.feed.getFeedGenerator(
        {
          feed: allUriBob.toString(),
        },
        { headers: await network.serviceHeaders(sc.dids.alice) },
      )
      expect(res.data.isOnline).toBe(false)
      expect(res.data.isValid).toBe(false)
    })
  })

  describe('getFeedGenerators', () => {
    it('describes multiple feed gens', async () => {
      const resEven = await agent.api.app.bsky.feed.getFeedGenerators(
        { feeds: [feedUriEven, feedUriAll, feedUriPrime] },
        { headers: await network.serviceHeaders(sc.dids.bob) },
      )
      expect(forSnapshot(resEven.data)).toMatchSnapshot()
      expect(resEven.data.feeds.map((fg) => fg.uri)).not.toContain(feedUriPrime) // taken-down
    })
  })

  describe('getPopularFeedGenerators', () => {
    it('gets popular feed generators', async () => {
      const resEven =
        await agent.api.app.bsky.unspecced.getPopularFeedGenerators(
          {},
          { headers: await network.serviceHeaders(sc.dids.bob) },
        )
      expect(resEven.data.feeds.map((f) => f.likeCount)).toEqual([2, 0, 0, 0])
      expect(resEven.data.feeds.map((f) => f.uri)).not.toContain(feedUriPrime) // taken-down
    })
  })

  describe('getFeed', () => {
    it('resolves basic feed contents.', async () => {
      const feed = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: await network.serviceHeaders(alice, gen.did) },
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
          { headers: await network.serviceHeaders(alice, gen.did) },
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

    it('paginates, handling feed not respecting limit.', async () => {
      const res = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriBadPagination, limit: 3 },
        { headers: await network.serviceHeaders(alice, gen.did) },
      )
      // refused to respect pagination limit, so it got cut short by appview but the cursor remains.
      expect(res.data.feed.length).toBeLessThanOrEqual(3)
      expect(parseInt(res.data.cursor || '', 10)).toBeGreaterThanOrEqual(3)
      expect(res.data.feed.map((item) => item.post.uri)).toEqual([
        sc.posts[sc.dids.alice][0].ref.uriStr,
        sc.posts[sc.dids.bob][0].ref.uriStr,
        sc.posts[sc.dids.carol][0].ref.uriStr,
      ])
    })

    it('fails on unknown feed.', async () => {
      const tryGetFeed = agent.api.app.bsky.feed.getFeed(
        { feed: feedUriOdd },
        { headers: await network.serviceHeaders(alice, gen.did) },
      )
      await expect(tryGetFeed).rejects.toThrow(UnknownFeedError)
    })

    it('resolves contents of taken-down feed.', async () => {
      const tryGetFeed = agent.api.app.bsky.feed.getFeed(
        { feed: feedUriPrime },
        { headers: await network.serviceHeaders(alice) },
      )
      await expect(tryGetFeed).resolves.toBeDefined()
    })

    it('receives proper auth details.', async () => {
      const feed = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: await network.serviceHeaders(alice, gen.did) },
      )
      expect(feed.data['$auth']?.['aud']).toEqual(gen.did)
      expect(feed.data['$auth']?.['iss']).toEqual(alice)
    })

    it('receives proper auth details.', async () => {
      const feed = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: await network.serviceHeaders(alice, gen.did) },
      )
      expect(feed.data['$auth']?.['aud']).toEqual(gen.did)
      expect(feed.data['$auth']?.['iss']).toEqual(alice)
    })

    it('provides timing info in server-timing header.', async () => {
      const result = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: await network.serviceHeaders(alice, gen.did) },
      )
      expect(result.headers['server-timing']).toMatch(
        /^skele;dur=\d+, hydr;dur=\d+$/,
      )
    })

    it('returns an upstream failure error when the feed is down.', async () => {
      await gen.close() // @NOTE must be last test
      const tryGetFeed = agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: await network.serviceHeaders(alice, gen.did) },
      )
      await expect(tryGetFeed).rejects.toThrow('feed unavailable')
    })
  })

  const feedGenHandler =
    (feedName: 'even' | 'all' | 'prime' | 'bad-pagination'): SkeletonHandler =>
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
      const fullFeed = candidates.filter((_, i) => {
        if (feedName === 'even') {
          return i % 2 === 0
        }
        if (feedName === 'prime') {
          return [2, 3, 5, 7, 11, 13].includes(i)
        }
        return true
      })
      const feedResults =
        feedName === 'bad-pagination'
          ? fullFeed.slice(offset) // does not respect limit
          : fullFeed.slice(offset, offset + limit)
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
