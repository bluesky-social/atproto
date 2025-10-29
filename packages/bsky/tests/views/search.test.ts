import { AtpAgent } from '@atproto/api'
import { QueryParams as SearchPostsQueryParams } from '@atproto/api/src/client/types/app/bsky/feed/searchPosts'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { DatabaseSchema } from '../../src'
import { ids } from '../../src/lexicon/lexicons'

const TAG_HIDE = 'hide'

describe('appview search', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let post0: Awaited<ReturnType<SeedClient['post']>>
  let post1: Awaited<ReturnType<SeedClient['post']>>
  let post2: Awaited<ReturnType<SeedClient['post']>>
  let allResults: string[]
  let nonTaggedResults: string[]

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_search',
      bsky: {
        searchTagsHide: new Set([TAG_HIDE]),
      },
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)

    post0 = await sc.post(sc.dids.alice, 'good doggo')
    post1 = await sc.post(sc.dids.alice, 'bad doggo')
    post2 = await sc.post(sc.dids.alice, 'cute doggo')
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
      queryParams: () => SearchPostsQueryParams
      expectedPostUris: () => string[]
    }

    const tests: TestCase[] = [
      // 'top' cases
      {
        name: `with 'top' sort, finds only non-tagged posts`,
        queryParams: () => ({ q: 'doggo', sort: 'top' }),
        expectedPostUris: () => nonTaggedResults,
      },
      {
        name: `with 'top' sort, finds only non-tagged posts, even specifying author`,
        queryParams: () => ({ q: `doggo`, author: sc.dids.alice, sort: 'top' }),
        expectedPostUris: () => nonTaggedResults,
      },
      {
        name: `with 'top' sort, finds only non-tagged posts, even specifying from:`,
        queryParams: () => ({
          q: `doggo from:${sc.accounts[sc.dids.alice].handle}`,
          sort: 'top',
        }),
        expectedPostUris: () => nonTaggedResults,
      },
      {
        name: `with 'top' sort, finds only non-tagged posts, even specifying DID`,
        queryParams: () => ({ q: `doggo ${sc.dids.alice}`, sort: 'top' }),
        expectedPostUris: () => nonTaggedResults,
      },
      {
        name: `with 'top' sort, finds no posts if specifying user who didn't post the term`,
        queryParams: () => ({ q: `doggo ${sc.dids.bob}`, sort: 'top' }),
        expectedPostUris: () => [],
      },

      // 'latest' cases
      {
        name: `with 'latest' sort, finds only non-tagged posts`,
        queryParams: () => ({ q: 'doggo', sort: 'latest' }),
        expectedPostUris: () => nonTaggedResults,
      },
      {
        name: `with 'latest' sort, finds all posts if specifying author`,
        queryParams: () => ({
          q: `doggo`,
          author: sc.dids.alice,
          sort: 'latest',
        }),
        expectedPostUris: () => allResults,
      },
      {
        name: `with 'latest' sort, finds all posts if specifying from:`,
        queryParams: () => ({
          q: `doggo from:${sc.accounts[sc.dids.alice].handle}`,
          sort: 'latest',
        }),
        expectedPostUris: () => allResults,
      },
      {
        name: `with 'latest' sort, finds all posts if specifying DID`,
        queryParams: () => ({ q: `doggo ${sc.dids.alice}`, sort: 'latest' }),
        expectedPostUris: () => allResults,
      },
      {
        name: `with 'latest' sort, finds no posts if specifying user who didn't post the term`,
        queryParams: () => ({ q: `doggo ${sc.dids.bob}`, sort: 'latest' }),
        expectedPostUris: () => [],
      },
    ]

    it.each(tests)('$name', async ({ queryParams, expectedPostUris }) => {
      const res = await agent.app.bsky.feed.searchPosts(queryParams(), {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedSearchPosts,
        ),
      })
      expect(res.data.posts.map((p) => p.uri)).toStrictEqual(expectedPostUris())
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
