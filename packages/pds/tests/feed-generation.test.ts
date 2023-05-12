import { AtpAgent } from '@atproto/api'
import { Handler as SkeletonHandler } from '@atproto/pds/src/lexicon/types/app/bsky/feed/getFeedSkeleton'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { TestFeedGen } from '@atproto/dev-env/src/feed-gen'
import { TID } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { forSnapshot, paginateAll } from './_util'
import {
  FeedViewPost,
  GeneratorView,
} from '@atproto/api/src/client/types/app/bsky/feed/defs'

describe('feed generation', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let gen: TestFeedGen

  let alice: string
  let feedUriAll: string
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
    gen = await network.createFeedGen(feedGenHandler)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  it('feed gen records can be created.', async () => {
    const all = await agent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'all' },
      {
        did: gen.did,
        description: 'Provides all feed candidates',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    const even = await agent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'even' },
      {
        did: gen.did,
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
        description: 'Provides odd-indexed feed candidates',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    feedUriAll = all.uri
    feedUriEven = even.uri
    feedUriOdd = odd.uri
  })

  it('getActorFeeds fetches feed generators by actor.', async () => {
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
      expect(forSnapshot(paginatedAll)).toMatchSnapshot() // @TODO check reply hydration
    })

    it('fails on unknown feed.', async () => {
      const tryGetFeed = agent.api.app.bsky.feed.getFeed(
        { feed: feedUriOdd },
        { headers: sc.getHeaders(alice) },
      )
      await expect(tryGetFeed).rejects.toThrow('Unknown feed') // @TODO consider adding this error to getFeed lexicon
    })

    it('receives proper auth details.', async () => {
      const feed = await agent.api.app.bsky.feed.getFeed(
        { feed: feedUriEven },
        { headers: sc.getHeaders(alice) },
      )
      expect(feed.data['$auth']?.['aud']).toEqual(gen.did)
      expect(feed.data['$auth']?.['iss']).toEqual(alice)
    })
  })

  const feedGenHandler: SkeletonHandler = async ({ req, params }) => {
    const { feed, limit, cursor } = params
    const feedName = feed.split('/').at(-1)
    if (feedName !== 'all' && feedName !== 'even') {
      throw new InvalidRequestError('Unknown feed')
    }
    const candidates = [
      { post: sc.posts[sc.dids.alice][0].ref.uriStr },
      { post: sc.posts[sc.dids.bob][0].ref.uriStr },
      { post: sc.posts[sc.dids.carol][0].ref.uriStr },
      // Post doesn't exist
      { post: `at://did:plc:unknown/app.bsky.feed.post/${TID.nextStr()}` },
      // Reply (accurate)
      {
        post: sc.replies[sc.dids.carol][0].ref.uriStr,
        replyTo: {
          root: sc.posts[alice][1].ref.uriStr,
          parent: sc.posts[alice][1].ref.uriStr,
        },
      },
      // Repost (accurate)
      {
        post: sc.posts[sc.dids.dan][1].ref.uriStr,
        reason: {
          $type: 'app.bsky.feed.defs#skeletonReasonRepost',
          by: sc.dids.carol,
          indexedAt: new Date().toISOString(),
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
