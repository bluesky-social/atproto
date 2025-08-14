import assert from 'node:assert'
import { AtUri, AtpAgent } from '@atproto/api'
import { TID } from '@atproto/common'
import {
  RecordRef,
  SeedClient,
  TestFeedGen,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { XRPCError } from '@atproto/xrpc'
import { AuthRequiredError, MethodHandler } from '@atproto/xrpc-server'
import { ids } from '../src/lexicon/lexicons'
import {
  FeedViewPost,
  SkeletonFeedPost,
} from '../src/lexicon/types/app/bsky/feed/defs'
import { OutputSchema as GetActorFeedsOutputSchema } from '../src/lexicon/types/app/bsky/feed/getActorFeeds'
import { OutputSchema as GetFeedOutputSchema } from '../src/lexicon/types/app/bsky/feed/getFeed'
import * as AppBskyFeedGetFeedSkeleton from '../src/lexicon/types/app/bsky/feed/getFeedSkeleton'
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
  let feedUriBadPaginationLimit: string
  let feedUriBadPaginationCursor: string
  let feedUriPrime: string // Taken-down
  let feedUriPrimeRef: RecordRef
  let feedUriNeedsAuth: string
  let feedUriContentModeVideo: string
  let feedUriAcceptsInteractions: string
  let starterPackRef: { uri: string; cid: string }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_feed_generation',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
    const allUri = AtUri.make(alice, 'app.bsky.feed.generator', 'all')
    const feedUriBadPaginationLimit = AtUri.make(
      alice,
      'app.bsky.feed.generator',
      'bad-pagination-limit',
    )
    const feedUriBadPaginationCursor = AtUri.make(
      alice,
      'app.bsky.feed.generator',
      'bad-pagination-cursor',
    )
    const evenUri = AtUri.make(alice, 'app.bsky.feed.generator', 'even')
    const primeUri = AtUri.make(alice, 'app.bsky.feed.generator', 'prime')
    const needsAuthUri = AtUri.make(
      alice,
      'app.bsky.feed.generator',
      'needs-auth',
    )
    const acceptsInteractionsUri = AtUri.make(
      alice,
      'app.bsky.feed.generator',
      'accepts-interactions',
    )
    gen = await network.createFeedGen({
      [allUri.toString()]: feedGenHandler('all'),
      [evenUri.toString()]: feedGenHandler('even'),
      [feedUriBadPaginationLimit.toString()]: feedGenHandler(
        'bad-pagination-limit',
      ),
      [feedUriBadPaginationCursor.toString()]: feedGenHandler(
        'bad-pagination-cursor',
      ),
      [primeUri.toString()]: feedGenHandler('prime'),
      [needsAuthUri.toString()]: feedGenHandler('needs-auth'),
      [acceptsInteractionsUri.toString()]: feedGenHandler(
        'accepts-interactions',
      ),
    })

    const feedSuggestions = [
      { uri: allUri.toString(), order: 1 },
      { uri: evenUri.toString(), order: 2 },
      { uri: feedUriBadPaginationLimit.toString(), order: 3 },
      { uri: primeUri.toString(), order: 4 },
    ]
    await network.bsky.db.db
      .insertInto('suggested_feed')
      .values(feedSuggestions)
      .execute()
  })

  afterAll(async () => {
    await gen.close()
    await network.close()
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

    const badPaginationLimit =
      await pdsAgent.api.app.bsky.feed.generator.create(
        { repo: alice, rkey: 'bad-pagination-limit' },
        {
          did: gen.did,
          displayName: 'Bad Pagination Limit',
          description:
            'Provides all feed candidates, blindly ignoring pagination limit',
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(alice),
      )
    const badPaginationCursor =
      await pdsAgent.api.app.bsky.feed.generator.create(
        { repo: alice, rkey: 'bad-pagination-cursor' },
        {
          did: gen.did,
          displayName: 'Bad Pagination Cursor',
          description: 'Echoes back the same cursor it received',
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
    const needsAuth = await pdsAgent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'needs-auth' },
      {
        did: gen.did,
        displayName: 'Needs Auth',
        description: 'Provides all feed candidates when authed',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    const contentModeVideo = await pdsAgent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'content-mode-video' },
      {
        did: gen.did,
        displayName: 'Content mode video',
        description: 'Has a contentMode specified',
        createdAt: new Date().toISOString(),
        contentMode: 'app.bsky.feed.defs#contentModeVideo',
      },
      sc.getHeaders(alice),
    )
    const acceptsInteraction =
      await pdsAgent.api.app.bsky.feed.generator.create(
        { repo: alice, rkey: 'accepts-interactions' },
        {
          did: gen.did,
          displayName: 'Accepts Interactions',
          description: 'Has acceptsInteractions set to true',
          acceptsInteractions: true,
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(alice),
      )
    await network.processAll()
    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: prime.uri,
    })

    feedUriAll = all.uri
    feedUriAllRef = new RecordRef(all.uri, all.cid)
    feedUriEven = even.uri
    feedUriOdd = odd.uri
    feedUriBadPaginationLimit = badPaginationLimit.uri
    feedUriBadPaginationCursor = badPaginationCursor.uri
    feedUriPrime = prime.uri
    feedUriPrimeRef = new RecordRef(prime.uri, prime.cid)
    feedUriNeedsAuth = needsAuth.uri
    feedUriContentModeVideo = contentModeVideo.uri
    feedUriAcceptsInteractions = acceptsInteraction.uri
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
  })

  it('getActorFeeds fetches feed generators by actor.', async () => {
    // add some likes
    await sc.like(sc.dids.bob, feedUriAllRef)
    await sc.like(sc.dids.carol, feedUriAllRef)
    await network.processAll()

    const results = (results: GetActorFeedsOutputSchema[]) =>
      results.flatMap((res) => res.feeds)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getActorFeeds(
        { actor: alice, cursor, limit: 2 },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyFeedGetActorFeeds,
          ),
        },
      )
      return res.data
    }

    const paginatedAll = results(await paginateAll(paginator))

    expect(paginatedAll.length).toEqual(8)
    expect(paginatedAll[0].uri).toEqual(feedUriOdd)
    expect(paginatedAll[1].uri).toEqual(feedUriAcceptsInteractions)
    expect(paginatedAll[2].uri).toEqual(feedUriContentModeVideo)
    expect(paginatedAll[3].uri).toEqual(feedUriNeedsAuth)
    expect(paginatedAll[4].uri).toEqual(feedUriBadPaginationCursor)
    expect(paginatedAll[5].uri).toEqual(feedUriBadPaginationLimit)
    expect(paginatedAll[6].uri).toEqual(feedUriEven)
    expect(paginatedAll[7].uri).toEqual(feedUriAll)
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
    const view = await agent.api.app.bsky.feed.getPosts(
      { uris: [res.uri] },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyFeedGetPosts,
        ),
      },
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
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )
    expect(view.data.posts.length).toBe(1)
    expect(forSnapshot(view.data.posts[0])).toMatchSnapshot()
  })

  it('embeds starter pack records in posts', async () => {
    const listRes = await pdsAgent.api.app.bsky.graph.list.create(
      {
        repo: sc.dids.alice,
      },
      {
        name: 'awesome starter pack!',
        description: '',
        descriptionFacets: [],
        avatar: undefined,
        createdAt: new Date().toISOString(),
        purpose: 'app.bsky.graph.defs#referencelist',
      },
      sc.getHeaders(sc.dids.alice),
    )
    const starterPackRes = await pdsAgent.api.app.bsky.graph.starterpack.create(
      {
        repo: sc.dids.alice,
      },
      {
        name: 'awesome starter pack!',
        description: '',
        descriptionFacets: [],
        feeds: [],
        list: listRes.uri,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.alice),
    )
    starterPackRef = {
      uri: starterPackRes.uri,
      cid: starterPackRes.cid,
    }
    const res = await pdsAgent.api.app.bsky.feed.post.create(
      { repo: sc.dids.bob },
      {
        text: 'sick starter pack!',
        embed: {
          $type: 'app.bsky.embed.record',
          record: starterPackRef,
        },
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.bob),
    )
    await network.processAll()
    const view = await agent.api.app.bsky.feed.getPosts(
      { uris: [res.uri] },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )
    expect(view.data.posts.length).toBe(1)
    expect(forSnapshot(view.data.posts[0])).toMatchSnapshot()
  })

  it('does not embed taken-down starter pack records in posts', async () => {
    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: starterPackRef.uri,
    })
    const res = await pdsAgent.api.app.bsky.feed.post.create(
      { repo: sc.dids.bob },
      {
        text: 'annoying starter pack',
        embed: {
          $type: 'app.bsky.embed.record',
          record: starterPackRef,
        },
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.bob),
    )
    await network.processAll()
    const view = await agent.api.app.bsky.feed.getPosts(
      { uris: [res.uri] },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )
    expect(view.data.posts.length).toBe(1)
    expect(forSnapshot(view.data.posts[0])).toMatchSnapshot()
  })

  describe('getFeedGenerator', () => {
    it('describes a feed gen & returns online status', async () => {
      const resEven = await agent.api.app.bsky.feed.getFeedGenerator(
        { feed: feedUriAll },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyFeedGetFeedGenerator,
          ),
        },
      )
      expect(forSnapshot(resEven.data)).toMatchSnapshot()
      expect(resEven.data.isOnline).toBe(true)
      expect(resEven.data.isValid).toBe(true)
    })

    it('describes a feed gen & returns content mode', async () => {
      const resEven = await agent.api.app.bsky.feed.getFeedGenerator(
        { feed: feedUriContentModeVideo },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyFeedGetFeedGenerator,
          ),
        },
      )
      expect(forSnapshot(resEven.data)).toMatchSnapshot()
      expect(resEven.data.view.contentMode).toBe(
        'app.bsky.feed.defs#contentModeVideo',
      )
    })

    it('describes a feed gen & returns acceptsInteractions when true', async () => {
      const resAcceptsInteractions =
        await agent.api.app.bsky.feed.getFeedGenerator(
          { feed: feedUriAcceptsInteractions },
          {
            headers: await network.serviceHeaders(
              sc.dids.bob,
              ids.AppBskyFeedGetFeedGenerator,
            ),
          },
        )
      expect(forSnapshot(resAcceptsInteractions.data)).toMatchSnapshot()
      expect(resAcceptsInteractions.data.view.acceptsInteractions).toBe(true)
    })

    it('does not describe taken-down feed', async () => {
      const tryGetFeed = agent.api.app.bsky.feed.getFeedGenerator(
        { feed: feedUriPrime },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyFeedGetFeedGenerator,
          ),
        },
      )
      await expect(tryGetFeed).rejects.toThrow('could not find feed')
    })

    // @TODO temporarily skipping while external feedgens catch-up on describeFeedGenerator
    it.skip('handles an unsupported algo', async () => {
      const resOdd = await agent.api.app.bsky.feed.getFeedGenerator(
        { feed: feedUriOdd },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyFeedGetFeedGenerator,
          ),
        },
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

      // now take it offline
      await bobFg.close()

      const res = await agent.api.app.bsky.feed.getFeedGenerator(
        {
          feed: allUriBob.toString(),
        },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyFeedGetFeedGenerator,
          ),
        },
      )
      expect(res.data.isOnline).toBe(false)
      expect(res.data.isValid).toBe(false)
    })
  })

  describe('getFeedGenerators', () => {
    it('describes multiple feed gens', async () => {
      const resEven = await agent.api.app.bsky.feed.getFeedGenerators(
        { feeds: [feedUriEven, feedUriAll, feedUriPrime] },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyFeedGetFeedGenerators,
          ),
        },
      )
      expect(forSnapshot(resEven.data)).toMatchSnapshot()
      expect(resEven.data.feeds.map((fg) => fg.uri)).not.toContain(feedUriPrime) // taken-down
    })
  })

  describe('getSuggestedFeeds', () => {
    it('returns list of suggested feed generators', async () => {
      const resEven = await agent.api.app.bsky.feed.getSuggestedFeeds(
        {},
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyFeedGetSuggestedFeeds,
          ),
        },
      )
      expect(forSnapshot(resEven.data)).toMatchSnapshot()
      expect(resEven.data.feeds.map((fg) => fg.uri)).not.toContain(feedUriPrime) // taken-down
    })
  })

  describe('getPopularFeedGenerators', () => {
    it('gets popular feed generators', async () => {
      const res = await agent.api.app.bsky.unspecced.getPopularFeedGenerators(
        {},
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyUnspeccedGetPopularFeedGenerators,
          ),
        },
      )
      expect(res.data.feeds.map((f) => f.uri)).not.toContain(feedUriPrime) // taken-down
      expect(res.data.feeds.map((f) => f.uri)).toEqual([
        feedUriAll,
        feedUriEven,
        feedUriBadPaginationLimit,
      ])
    })

    it('searches feed generators', async () => {
      const res = await agent.api.app.bsky.unspecced.getPopularFeedGenerators(
        { query: 'all' },
        {
          headers: await network.serviceHeaders(
            sc.dids.bob,
            ids.AppBskyUnspeccedGetPopularFeedGenerators,
          ),
        },
      )
      expect(res.data.feeds.map((f) => f.uri)).toEqual([feedUriAll])
    })

    it('paginates', async () => {
      const resFull =
        await agent.api.app.bsky.unspecced.getPopularFeedGenerators(
          {},
          {
            headers: await network.serviceHeaders(
              sc.dids.bob,
              ids.AppBskyUnspeccedGetPopularFeedGenerators,
            ),
          },
        )
      const resOne =
        await agent.api.app.bsky.unspecced.getPopularFeedGenerators(
          { limit: 2 },
          {
            headers: await network.serviceHeaders(
              sc.dids.bob,
              ids.AppBskyUnspeccedGetPopularFeedGenerators,
            ),
          },
        )
      const resTwo =
        await agent.api.app.bsky.unspecced.getPopularFeedGenerators(
          { cursor: resOne.data.cursor },
          {
            headers: await network.serviceHeaders(
              sc.dids.bob,
              ids.AppBskyUnspeccedGetPopularFeedGenerators,
            ),
          },
        )
      expect([...resOne.data.feeds, ...resTwo.data.feeds]).toEqual(
        resFull.data.feeds,
      )
    })
  })

  describe('getFeed', () => {
    it('resolves basic feed contents.', async () => {
      const feed = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetFeed,
            gen.did,
          ),
        },
      )
      expect(feed.data.feed.map((item) => item.post.uri)).toEqual([
        sc.posts[sc.dids.alice][0].ref.uriStr,
        sc.posts[sc.dids.carol][0].ref.uriStr,
        sc.replies[sc.dids.carol][0].ref.uriStr,
      ])
      expect(forSnapshot(feed.data.feed)).toMatchSnapshot()
    })

    it('resolves basic feed contents without auth.', async () => {
      const feed = await agent.api.app.bsky.feed.getFeed({ feed: feedUriEven })
      expect(feed.data.feed.map((item) => item.post.uri)).toEqual([
        sc.posts[sc.dids.alice][0].ref.uriStr,
        sc.posts[sc.dids.carol][0].ref.uriStr,
        sc.replies[sc.dids.carol][0].ref.uriStr,
      ])
      expect(forSnapshot(feed.data.feed)).toMatchSnapshot()
    })

    it('paginates, handling replies and reposts.', async () => {
      const results = (results: GetFeedOutputSchema[]) =>
        results.flatMap((res) => res.feed)
      const paginator = async (cursor?: string) => {
        const res = await agent.api.app.bsky.feed.getFeed(
          { feed: feedUriAll, cursor, limit: 2 },
          {
            headers: await network.serviceHeaders(
              alice,
              ids.AppBskyFeedGetFeed,
              gen.did,
            ),
          },
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
        { feed: feedUriBadPaginationLimit, limit: 3 },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetFeed,
            gen.did,
          ),
        },
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
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetFeed,
            gen.did,
          ),
        },
      )
      await expect(tryGetFeed).rejects.toMatchObject({
        error: 'UnknownFeed',
      })
    })

    it('returns empty cursor with feeds that echo back the same cursor from the param.', async () => {
      const res = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriBadPaginationCursor, cursor: '1', limit: 2 },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetFeed,
            gen.did,
          ),
        },
      )

      expect(res.data.cursor).toBeUndefined()
      expect(res.data.feed).toHaveLength(2)
    })

    it('resolves contents of taken-down feed.', async () => {
      const tryGetFeed = agent.api.app.bsky.feed.getFeed(
        { feed: feedUriPrime },
        {
          headers: await network.serviceHeaders(alice, ids.AppBskyFeedGetFeed),
        },
      )
      await expect(tryGetFeed).resolves.toBeDefined()
    })

    it('receives proper auth details.', async () => {
      const feed = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetFeedSkeleton,
            gen.did,
          ),
        },
      )
      expect(feed.data['$auth']?.['aud']).toEqual(gen.did)
      expect(feed.data['$auth']?.['iss']).toEqual(alice)
      expect(feed.data['$auth']?.['lxm']).toEqual(
        ids.AppBskyFeedGetFeedSkeleton,
      )
    })

    it('passes through auth error from feed.', async () => {
      const tryGetFeed = agent.api.app.bsky.feed.getFeed({
        feed: feedUriNeedsAuth,
      })
      const err = await tryGetFeed.catch((err) => err)
      assert(err instanceof XRPCError)
      expect(err.status).toBe(401)
      expect(err.message).toBe('This feed requires auth')
    })

    it('provides timing info in server-timing header.', async () => {
      const result = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetFeed,
            gen.did,
          ),
        },
      )
      expect(result.headers['server-timing']).toMatch(
        /^skele;dur=\d+, hydr;dur=\d+$/,
      )
    })

    it('returns an upstream failure error when the feed is down.', async () => {
      await gen.close() // @NOTE must be last test
      const tryGetFeed = agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedGetFeed,
            gen.did,
          ),
        },
      )
      await expect(tryGetFeed).rejects.toThrow('feed unavailable')
    })
  })

  const feedGenHandler =
    (
      feedName:
        | 'even'
        | 'all'
        | 'prime'
        | 'bad-pagination-limit'
        | 'bad-pagination-cursor'
        | 'needs-auth'
        | 'accepts-interactions',
    ): MethodHandler<
      void,
      AppBskyFeedGetFeedSkeleton.QueryParams,
      AppBskyFeedGetFeedSkeleton.HandlerInput,
      AppBskyFeedGetFeedSkeleton.HandlerOutput
    > =>
    async ({ req, params }) => {
      if (feedName === 'needs-auth' && !req.headers.authorization) {
        throw new AuthRequiredError('This feed requires auth')
      }
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
      ].map((item, i) => ({ ...item, feedContext: `item-${i}` })) // add a deterministic context to test passthrough
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
        feedName === 'bad-pagination-limit'
          ? fullFeed.slice(offset) // does not respect limit
          : fullFeed.slice(offset, offset + limit)
      const lastResult = feedResults.at(-1)
      const cursorResult =
        feedName === 'bad-pagination-cursor'
          ? cursor
          : lastResult
            ? (fullFeed.indexOf(lastResult) + 1).toString()
            : undefined

      return {
        encoding: 'application/json',
        body: {
          feed: feedResults,
          cursor: cursorResult,
          reqId: 'req-id-abc-def-ghi',
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
