import { AtpAgent } from '@atproto/api'
import { QueryParams as SearchPostsQueryParams } from '@atproto/api/src/client/types/app/bsky/feed/searchPosts'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { DatabaseSchema } from '../../src'
import { ids } from '../../src/lexicon/lexicons'

const TAG_HIDE = 'hide'

describe('appview search', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let ozoneAgent: AtpAgent
  let sc: SeedClient
  let post0: Awaited<ReturnType<SeedClient['post']>>
  let post1: Awaited<ReturnType<SeedClient['post']>>
  let post2: Awaited<ReturnType<SeedClient['post']>>
  let allResults: string[]
  let nonTaggedResults: string[]

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_search',
      bsky: {
        searchTagsHide: new Set([TAG_HIDE]),
      },
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    ozoneAgent = network.ozone.getClient()
    await basicSeed(sc)

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol

    post0 = await sc.post(alice, 'good doggo')
    post1 = await sc.post(alice, 'bad doggo')
    post2 = await sc.post(alice, 'cute doggo')
    await network.processAll()

    await createTag(network.bsky.db.db, {
      uri: post1.ref.uriStr,
      val: TAG_HIDE,
    })

    allResults = [post2.ref.uriStr, post1.ref.uriStr, post0.ref.uriStr]
    nonTaggedResults = [post2.ref.uriStr, post0.ref.uriStr]
  })

  afterAll(async () => {
    await deleteTags(network.bsky.db.db, {
      uri: post1.ref.uriStr,
    })

    await network.close()
  })

  describe(`post search with 'top' sort`, () => {
    type TestCase = {
      name: string
      viewer: () => string
      queryParams: () => SearchPostsQueryParams
      expectedPostUris: () => string[]
    }

    const tests: TestCase[] = [
      // 'top' cases
      {
        name: `with 'top' sort, finds only non-tagged posts`,
        viewer: () => carol,
        queryParams: () => ({ q: 'doggo', sort: 'top' }),
        expectedPostUris: () => nonTaggedResults,
      },
      {
        name: `with 'top' sort, includes tagged posts from the viewer`,
        viewer: () => alice,
        queryParams: () => ({ q: 'doggo', sort: 'top' }),
        expectedPostUris: () => allResults,
      },
      {
        name: `with 'top' sort, finds only non-tagged posts, even specifying author`,
        viewer: () => carol,
        queryParams: () => ({ q: `doggo`, author: alice, sort: 'top' }),
        expectedPostUris: () => nonTaggedResults,
      },
      {
        name: `with 'top' sort, finds only non-tagged posts, even specifying from:`,
        viewer: () => carol,
        queryParams: () => ({
          q: `doggo from:${sc.accounts[alice].handle}`,
          sort: 'top',
        }),
        expectedPostUris: () => nonTaggedResults,
      },
      {
        name: `with 'top' sort, finds only non-tagged posts, even specifying DID`,
        viewer: () => carol,
        queryParams: () => ({ q: `doggo ${alice}`, sort: 'top' }),
        expectedPostUris: () => nonTaggedResults,
      },
      {
        name: `with 'top' sort, finds no posts if specifying user who didn't post the term`,
        viewer: () => carol,
        queryParams: () => ({ q: `doggo ${bob}`, sort: 'top' }),
        expectedPostUris: () => [],
      },

      // 'latest' cases
      {
        name: `with 'latest' sort, finds only non-tagged posts`,
        viewer: () => carol,
        queryParams: () => ({ q: 'doggo', sort: 'latest' }),
        expectedPostUris: () => nonTaggedResults,
      },
      {
        name: `with 'latest' sort, includes tagged posts from the viewer`,
        viewer: () => alice,
        queryParams: () => ({ q: 'doggo', sort: 'latest' }),
        expectedPostUris: () => allResults,
      },
      {
        name: `with 'latest' sort, finds all posts if specifying author`,
        viewer: () => carol,
        queryParams: () => ({
          q: `doggo`,
          author: alice,
          sort: 'latest',
        }),
        expectedPostUris: () => allResults,
      },
      {
        name: `with 'latest' sort, finds all posts if specifying from:`,
        viewer: () => carol,
        queryParams: () => ({
          q: `doggo from:${sc.accounts[alice].handle}`,
          sort: 'latest',
        }),
        expectedPostUris: () => allResults,
      },
      {
        name: `with 'latest' sort, finds all posts if specifying DID`,
        viewer: () => carol,
        queryParams: () => ({ q: `doggo ${alice}`, sort: 'latest' }),
        expectedPostUris: () => allResults,
      },
      {
        name: `with 'latest' sort, finds no posts if specifying user who didn't post the term`,
        viewer: () => carol,
        queryParams: () => ({ q: `doggo ${bob}`, sort: 'latest' }),
        expectedPostUris: () => [],
      },
    ]

    it.each(tests)(
      '$name',
      async ({ viewer, queryParams, expectedPostUris }) => {
        const res = await agent.app.bsky.feed.searchPosts(queryParams(), {
          headers: await network.serviceHeaders(
            viewer(),
            ids.AppBskyFeedSearchPosts,
          ),
        })
        expect(res.data.posts.map((p) => p.uri)).toStrictEqual(
          expectedPostUris(),
        )
      },
    )

    it('mod service finds even tagged posts', async () => {
      const resTop = await ozoneAgent.app.bsky.feed.searchPosts(
        { q: 'doggo', sort: 'top' },
        { headers: await network.ozone.modHeaders(ids.AppBskyFeedSearchPosts) },
      )
      const resLatest = await ozoneAgent.app.bsky.feed.searchPosts(
        { q: 'doggo', sort: 'latest' },
        { headers: await network.ozone.modHeaders(ids.AppBskyFeedSearchPosts) },
      )

      expect(resTop.data.posts.map((p) => p.uri)).toStrictEqual(allResults)
      expect(resLatest.data.posts.map((p) => p.uri)).toStrictEqual(allResults)
    })
  })
})

const createTag = async (
  db: DatabaseSchema,
  opts: {
    uri: string
    val: string
  },
) => {
  await db
    .updateTable('record')
    .set({
      tags: JSON.stringify([opts.val]),
    })
    .where('uri', '=', opts.uri)
    .returningAll()
    .execute()
}

const deleteTags = async (
  db: DatabaseSchema,
  opts: {
    uri: string
  },
) => {
  await db
    .updateTable('record')
    .set({
      tags: JSON.stringify([]),
    })
    .where('uri', '=', opts.uri)
    .returningAll()
    .execute()
}
