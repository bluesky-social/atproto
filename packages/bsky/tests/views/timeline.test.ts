import AtpAgent from '@atproto/api'
import { TestEnvInfo, runTestEnv } from '@atproto/dev-env'
import {
  appViewHeaders,
  forSnapshot,
  getOriginator,
  paginateAll,
  processAll,
} from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { FeedAlgorithm } from '../../src/api/app/bsky/util/feed'
import { FeedViewPost } from '../../src/lexicon/types/app/bsky/feed/defs'

describe('timeline views', () => {
  let agent: AtpAgent
  let testEnv: TestEnvInfo
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'bsky_views_home_feed',
    })
    agent = new AtpAgent({ service: testEnv.bsky.url })
    const pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
    await processAll(testEnv)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await testEnv.close()
  })

  // @TODO(bsky) blocks posts, reposts, replies by actor takedown via labels
  // @TODO(bsky) blocks posts, reposts, replies by record takedown via labels

  it("fetches authenticated user's home feed w/ reverse-chronological algorithm", async () => {
    const expectOriginatorFollowedBy = (did) => (item: FeedViewPost) => {
      const originator = getOriginator(item)
      // The user expects to see posts & reposts from themselves and follows
      if (did !== originator) {
        expect(sc.follows[did]).toHaveProperty(originator)
      }
    }

    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: await appViewHeaders(alice, testEnv),
      },
    )

    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()
    aliceTL.data.feed.forEach(expectOriginatorFollowedBy(alice))

    const bobTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: await appViewHeaders(bob, testEnv),
      },
    )

    expect(forSnapshot(bobTL.data.feed)).toMatchSnapshot()
    bobTL.data.feed.forEach(expectOriginatorFollowedBy(bob))

    const carolTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: await appViewHeaders(carol, testEnv),
      },
    )

    expect(forSnapshot(carolTL.data.feed)).toMatchSnapshot()
    carolTL.data.feed.forEach(expectOriginatorFollowedBy(carol))

    const danTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: await appViewHeaders(dan, testEnv),
      },
    )

    expect(forSnapshot(danTL.data.feed)).toMatchSnapshot()
    danTL.data.feed.forEach(expectOriginatorFollowedBy(dan))
  })

  it("fetches authenticated user's home feed w/ default algorithm", async () => {
    const defaultTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      {
        headers: await appViewHeaders(alice, testEnv),
      },
    )
    const reverseChronologicalTL = await agent.api.app.bsky.feed.getTimeline(
      { algorithm: FeedAlgorithm.ReverseChronological },
      {
        headers: await appViewHeaders(alice, testEnv),
      },
    )
    expect(defaultTL.data.feed).toEqual(reverseChronologicalTL.data.feed)
  })

  it('paginates reverse-chronological feed', async () => {
    const results = (results) => results.flatMap((res) => res.feed)
    const paginator = async (cursor?: string) => {
      const res = await agent.api.app.bsky.feed.getTimeline(
        {
          algorithm: FeedAlgorithm.ReverseChronological,
          cursor,
          limit: 4,
        },
        { headers: await appViewHeaders(carol, testEnv) },
      )
      return res.data
    }

    const paginatedAll = await paginateAll(paginator)
    paginatedAll.forEach((res) =>
      expect(res.feed.length).toBeLessThanOrEqual(4),
    )

    const full = await agent.api.app.bsky.feed.getTimeline(
      {
        algorithm: FeedAlgorithm.ReverseChronological,
      },
      { headers: await appViewHeaders(carol, testEnv) },
    )

    expect(full.data.feed.length).toEqual(7)
    expect(results(paginatedAll)).toEqual(results([full.data]))
  })
})
