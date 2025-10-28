import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { DatabaseSchema } from '../../src'
import { ids } from '../../src/lexicon/lexicons'
import { forSnapshot } from '../_util'

const TAG_HIDE = 'hide'

describe('appview search', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let post0: Awaited<ReturnType<SeedClient['post']>>
  let post1: Awaited<ReturnType<SeedClient['post']>>
  let post2: Awaited<ReturnType<SeedClient['post']>>
  let posts: Awaited<ReturnType<SeedClient['post']>>[]

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
    posts = [post0, post1, post2]
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('finds posts by search term and top sort', async () => {
    const res = await agent.app.bsky.feed.searchPosts(
      { q: 'doggo', sort: 'top' },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedSearchPosts,
        ),
      },
    )

    expect(res.data.posts.length).toBe(posts.length)
    expect(forSnapshot(res.data.posts)).toMatchSnapshot()
  })

  it('finds posts by search term and latest sort', async () => {
    const res = await agent.app.bsky.feed.searchPosts(
      { q: 'doggo', sort: 'latest' },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedSearchPosts,
        ),
      },
    )

    expect(res.data.posts.length).toBe(posts.length)
    expect(forSnapshot(res.data.posts)).toMatchSnapshot()
  })

  describe('hiding results', () => {
    const visiblePosts = [post0, post2]

    beforeAll(async () => {
      await createTag(network.bsky.db.db, {
        uri: post1.ref.uriStr,
        val: TAG_HIDE,
      })
      await network.processAll()
    })

    it('finds posts by search term and top sort', async () => {
      const res = await agent.app.bsky.feed.searchPosts(
        { q: 'doggo', sort: 'top' },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyFeedSearchPosts,
          ),
        },
      )

      expect(res.data.posts.length).toBe(visiblePosts.length)
      expect(forSnapshot(res.data.posts)).toMatchSnapshot()
    })

    it('finds posts by search term and latest sort', async () => {
      const res = await agent.app.bsky.feed.searchPosts(
        { q: 'doggo', sort: 'latest' },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyFeedSearchPosts,
          ),
        },
      )

      expect(res.data.posts.length).toBe(visiblePosts.length)
      expect(forSnapshot(res.data.posts)).toMatchSnapshot()
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
