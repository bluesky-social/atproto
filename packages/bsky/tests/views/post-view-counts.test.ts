import { Code, ConnectError } from '@connectrpc/connect'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
} from 'vitest'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { Client } from '@atproto/lex-client'
import type { AtUriString, DidString } from '@atproto/syntax'
import { app } from '../../src/lexicons/index.js'
import { FeatureStore, GetFeaturesResponse } from '../../src/proto/bsky_pb.js'

describe('private post view counts', () => {
  let network: TestNetwork
  let client: Client
  let sc: SeedClient
  let aliceUri: AtUriString
  let bobUri: AtUriString
  let backdatedUri: AtUriString
  const launch = new Date('2020-01-01T00:00:00Z')

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_post_view_counts',
      bsky: { postViewCountsStartAt: launch },
    })
    client = new Client(network.bsky.url)
    sc = network.getSeedClient()
    await basicSeed(sc)
    aliceUri = sc.posts[sc.dids.alice][0].ref.uriStr
    bobUri = sc.posts[sc.dids.bob][0].ref.uriStr
    const backdated = await sc.post(
      sc.dids.alice,
      'Imported historical post',
      undefined,
      undefined,
      undefined,
      { createdAt: '2000-01-01T00:00:00Z' },
    )
    backdatedUri = backdated.ref.uriStr
    await network.processAll()
  })

  beforeEach(() => {
    network.bsky.ctx.hydrator.config.postViewCountsStartAt = launch
  })
  afterAll(async () => network?.close())

  async function getPosts(uris: AtUriString[], viewer?: DidString) {
    const response = await client.call(
      app.bsky.feed.getPosts,
      { uris },
      {
        headers: viewer
          ? await network.serviceHeaders(viewer, app.bsky.feed.getPosts.$lxm)
          : undefined,
      },
    )
    return response.posts
  }

  it("only queries and returns the authenticated author's counts across repeated requests", async () => {
    using features = vi
      .spyOn(network.bsky.ctx.dataplane, 'getFeatures')
      .mockImplementation(
        async (req) =>
          new GetFeaturesResponse({
            entities: req.requests?.map(({ uid }) => ({
              uid,
              features: [
                {
                  key: 'unique_views',
                  value: { case: 'sint64Val', value: 123n },
                },
              ],
            })),
          }),
      )
    const uris = [aliceUri, bobUri]
    const own = await getPosts(uris, sc.dids.alice)
    expect(own.map((post) => post.viewCount)).toEqual([123, undefined])
    expect(features).toHaveBeenLastCalledWith(
      {
        store: FeatureStore.POST,
        requests: [{ uid: aliceUri, keys: ['unique_views'] }],
      },
      { signal: expect.any(AbortSignal) },
    )
    const publicPosts = await getPosts(uris)
    expect(publicPosts.every((post) => !Object.hasOwn(post, 'viewCount'))).toBe(
      true,
    )
    expect(features).toHaveBeenCalledTimes(1)
    const other = await getPosts(uris, sc.dids.bob)
    expect(other.map((post) => post.viewCount)).toEqual([undefined, 123])
    expect(features).toHaveBeenLastCalledWith(
      {
        store: FeatureStore.POST,
        requests: [{ uid: bobUri, keys: ['unique_views'] }],
      },
      { signal: expect.any(AbortSignal) },
    )
  })

  it('includes exactly 100 views through thread and author-feed hydration', async () => {
    using features = vi
      .spyOn(network.bsky.ctx.dataplane, 'getFeatures')
      .mockImplementation(
        async (req) =>
          new GetFeaturesResponse({
            entities: req.requests?.map(({ uid }) => ({
              uid,
              features: [
                {
                  key: 'unique_views',
                  value: { case: 'sint64Val', value: 100n },
                },
              ],
            })),
          }),
      )
    const result = await client.call(
      app.bsky.feed.getPostThread,
      { uri: aliceUri },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          app.bsky.feed.getPostThread.$lxm,
        ),
      },
    )
    expect(
      app.bsky.feed.defs.threadViewPost.$ifMatches(result.thread)?.post
        .viewCount,
    ).toBe(100)
    const parsed = await client.call(
      app.bsky.feed.getAuthorFeed,
      { actor: sc.dids.alice },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          app.bsky.feed.getAuthorFeed.$lxm,
        ),
      },
    )
    expect(
      parsed.feed.find(({ post }) => post.uri === aliceUri)?.post.viewCount,
    ).toBe(100)
    expect(
      parsed.feed.find(({ post }) => post.uri === backdatedUri)?.post.viewCount,
    ).toBeUndefined()
    expect(features).toHaveBeenCalled()
  })

  test.each([
    { note: 'unset cutoff', cutoff: undefined },
    { note: 'future cutoff', cutoff: new Date('2100-01-01T00:00:00Z') },
  ])('omits counts with $note', async ({ cutoff }) => {
    using features = vi.spyOn(network.bsky.ctx.dataplane, 'getFeatures')
    network.bsky.ctx.hydrator.config.postViewCountsStartAt = cutoff
    expect(
      (await getPosts([aliceUri], sc.dids.alice))[0].viewCount,
    ).toBeUndefined()
    expect(features).not.toHaveBeenCalled()
  })

  it('excludes historical posts imported after launch', async () => {
    using features = vi.spyOn(network.bsky.ctx.dataplane, 'getFeatures')
    expect(
      (await getPosts([backdatedUri], sc.dids.alice))[0].viewCount,
    ).toBeUndefined()
    expect(features).not.toHaveBeenCalled()
  })

  test.each([
    {
      note: 'cutoff boundary',
      indexedAt: launch,
      sortedAt: launch,
      expected: 123,
    },
    {
      note: 'prelaunch indexing',
      indexedAt: new Date(launch.getTime() - 1),
      sortedAt: launch,
      expected: undefined,
    },
    {
      note: 'prelaunch creation',
      indexedAt: launch,
      sortedAt: new Date(launch.getTime() - 1),
      expected: undefined,
    },
  ])('$note', async ({ indexedAt, sortedAt, expected }) => {
    const feed = network.bsky.ctx.hydrator.feed
    const original = feed.getPosts.bind(feed)
    using records = vi
      .spyOn(feed, 'getPosts')
      .mockImplementation(async (...args) => {
        const posts = await original(...args)
        const post = posts.get(aliceUri)
        if (post) posts.set(aliceUri, { ...post, indexedAt, sortedAt })
        return posts
      })
    using features = vi
      .spyOn(network.bsky.ctx.dataplane, 'getFeatures')
      .mockResolvedValue(
        new GetFeaturesResponse({
          entities: [
            {
              uid: aliceUri,
              features: [
                {
                  key: 'unique_views',
                  value: { case: 'sint64Val', value: 123n },
                },
              ],
            },
          ],
        }),
      )
    expect((await getPosts([aliceUri], sc.dids.alice))[0].viewCount).toBe(
      expected,
    )
    expect(features).toHaveBeenCalledTimes(expected === undefined ? 0 : 1)
    expect(records).toHaveBeenCalled()
  })

  test.each([Code.Unimplemented, Code.Unavailable, Code.DeadlineExceeded])(
    'preserves posts when the optional count read fails (%s)',
    async (code) => {
      using features = vi
        .spyOn(network.bsky.ctx.dataplane, 'getFeatures')
        .mockRejectedValue(new ConnectError('count unavailable', code))
      const posts = await getPosts([aliceUri], sc.dids.alice)
      expect(posts).toHaveLength(1)
      expect(posts[0].uri).toBe(aliceUri)
      expect(Object.hasOwn(posts[0], 'viewCount')).toBe(false)
      expect(features).toHaveBeenCalled()
    },
  )
})
