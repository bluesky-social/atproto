import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type AppBskyFeedSearchPosts, type AtpAgent, ids } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import type { DatabaseSchema } from '../../src/index.js'

const TAG_HIDE = 'hide'
const TAG_ALWAYS_HIDE = 'always-hide'

describe('appview search', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let ozoneAgent: AtpAgent
  let sc: SeedClient
  let post0: Awaited<ReturnType<SeedClient['post']>>
  let post1: Awaited<ReturnType<SeedClient['post']>>
  let post2: Awaited<ReturnType<SeedClient['post']>>
  // 'unicorn' term, kept separate from the 'doggo' posts above so the
  // always-hide cases don't perturb the existing expectations.
  let unicornPost: Awaited<ReturnType<SeedClient['post']>>
  let unicornPostAlwaysHidden: Awaited<ReturnType<SeedClient['post']>>
  // 'narwhal' term: post is untagged but its author's profile carries an
  // always-hide moderation tag, so it should be filtered on author grounds.
  let narwhalPostByTaggedAuthor: Awaited<ReturnType<SeedClient['post']>>
  let allResults: string[]
  let nonTaggedResults: string[]

  // account dids, for convenience
  let alice: DidString
  let bob: DidString
  let carol: DidString

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_search',
      bsky: {
        searchTagsHide: new Set([TAG_HIDE]),
        searchTagsHideAll: new Set([TAG_ALWAYS_HIDE]),
      },
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    ozoneAgent = network.ozone.getAgent()
    await basicSeed(sc)

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol

    post0 = await sc.post(alice, 'good doggo')
    post1 = await sc.post(alice, 'bad doggo')
    post2 = await sc.post(alice, 'cute doggo')
    await network.processAll()

    unicornPost = await sc.post(alice, 'a unicorn')
    unicornPostAlwaysHidden = await sc.post(alice, 'another unicorn')
    // Post by an author whose profile carries an always-hide tag. The post
    // itself is untagged.
    narwhalPostByTaggedAuthor = await sc.post(bob, 'a narwhal')
    await network.processAll()

    await createTag(network.bsky.db.db, {
      uri: post1.ref.uriStr,
      val: TAG_HIDE,
    })
    await createTag(network.bsky.db.db, {
      uri: unicornPostAlwaysHidden.ref.uriStr,
      val: TAG_ALWAYS_HIDE,
    })
    // Tag bob's profile record so the always-hide tag applies via the author.
    await createTag(network.bsky.db.db, {
      uri: `at://${bob}/app.bsky.actor.profile/self`,
      val: TAG_ALWAYS_HIDE,
    })

    allResults = [post2.ref.uriStr, post1.ref.uriStr, post0.ref.uriStr]
    nonTaggedResults = [post2.ref.uriStr, post0.ref.uriStr]
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

  describe(`post search with 'top' sort`, () => {
    type TestCase = {
      name: string
      viewer: () => string
      queryParams: () => AppBskyFeedSearchPosts.QueryParams
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

  describe('searchTagsHideAll', () => {
    // Unlike searchTagsHide, an always-hide tag is filtered from every
    // surface: both 'top' and 'latest', and even when an author is specified.
    it.each(['top', 'latest'] as const)(
      `with '%s' sort, hides always-hidden posts`,
      async (sort) => {
        const res = await agent.app.bsky.feed.searchPosts(
          { q: 'unicorn', sort },
          {
            headers: await network.serviceHeaders(
              carol,
              ids.AppBskyFeedSearchPosts,
            ),
          },
        )
        expect(res.data.posts.map((p) => p.uri)).toStrictEqual([
          unicornPost.ref.uriStr,
        ])
      },
    )

    it.each(['top', 'latest'] as const)(
      `with '%s' sort, hides always-hidden posts even when specifying author`,
      async (sort) => {
        const res = await agent.app.bsky.feed.searchPosts(
          { q: 'unicorn', author: alice, sort },
          {
            headers: await network.serviceHeaders(
              carol,
              ids.AppBskyFeedSearchPosts,
            ),
          },
        )
        expect(res.data.posts.map((p) => p.uri)).toStrictEqual([
          unicornPost.ref.uriStr,
        ])
      },
    )

    it('includes always-hidden posts from the viewer', async () => {
      const res = await agent.app.bsky.feed.searchPosts(
        { q: 'unicorn', sort: 'latest' },
        {
          headers: await network.serviceHeaders(
            alice,
            ids.AppBskyFeedSearchPosts,
          ),
        },
      )
      expect(res.data.posts.map((p) => p.uri)).toStrictEqual([
        unicornPostAlwaysHidden.ref.uriStr,
        unicornPost.ref.uriStr,
      ])
    })

    it('mod service finds even always-hidden posts', async () => {
      const res = await ozoneAgent.app.bsky.feed.searchPosts(
        { q: 'unicorn', sort: 'latest' },
        { headers: await network.ozone.modHeaders(ids.AppBskyFeedSearchPosts) },
      )
      expect(res.data.posts.map((p) => p.uri)).toStrictEqual([
        unicornPostAlwaysHidden.ref.uriStr,
        unicornPost.ref.uriStr,
      ])
    })
  })

  describe('hiding by author moderation tags', () => {
    // The post is untagged, but its author's profile carries an always-hide
    // tag, so it is filtered as if the post itself were tagged.
    it.each(['top', 'latest'] as const)(
      `with '%s' sort, hides posts by an always-hidden author`,
      async (sort) => {
        const res = await agent.app.bsky.feed.searchPosts(
          { q: 'narwhal', sort },
          {
            headers: await network.serviceHeaders(
              carol,
              ids.AppBskyFeedSearchPosts,
            ),
          },
        )
        expect(res.data.posts.map((p) => p.uri)).toStrictEqual([])
      },
    )

    it.each(['top', 'latest'] as const)(
      `with '%s' sort, hides posts by an always-hidden author even when specifying that author`,
      async (sort) => {
        const res = await agent.app.bsky.feed.searchPosts(
          { q: 'narwhal', author: bob, sort },
          {
            headers: await network.serviceHeaders(
              carol,
              ids.AppBskyFeedSearchPosts,
            ),
          },
        )
        expect(res.data.posts.map((p) => p.uri)).toStrictEqual([])
      },
    )

    it('includes posts by an always-hidden author when they are the viewer', async () => {
      const res = await agent.app.bsky.feed.searchPosts(
        { q: 'narwhal', sort: 'latest' },
        {
          headers: await network.serviceHeaders(
            bob,
            ids.AppBskyFeedSearchPosts,
          ),
        },
      )
      expect(res.data.posts.map((p) => p.uri)).toStrictEqual([
        narwhalPostByTaggedAuthor.ref.uriStr,
      ])
    })

    it('mod service finds posts by an always-hidden author', async () => {
      const res = await ozoneAgent.app.bsky.feed.searchPosts(
        { q: 'narwhal', sort: 'latest' },
        { headers: await network.ozone.modHeaders(ids.AppBskyFeedSearchPosts) },
      )
      expect(res.data.posts.map((p) => p.uri)).toStrictEqual([
        narwhalPostByTaggedAuthor.ref.uriStr,
      ])
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
