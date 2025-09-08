import assert from 'node:assert'
import {
  $Typed,
  AppBskyBookmarkCreateBookmark,
  AppBskyBookmarkDeleteBookmark,
  AppBskyFeedDefs,
  AtpAgent,
} from '@atproto/api'
import { RecordRef, SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { BookmarkView } from '../../src/lexicon/types/app/bsky/bookmark/defs'
import { OutputSchema as GetBookmarksOutputSchema } from '../../src/lexicon/types/app/bsky/bookmark/getBookmarks'
import { PostView } from '../../src/lexicon/types/app/bsky/feed/defs'
import { forSnapshot, paginateAll } from '../_util'

type Database = TestNetwork['bsky']['db']

describe('appview bookmarks views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let db: Database

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_bookmarks',
    })
    db = network.bsky.db
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterEach(async () => {
    jest.resetAllMocks()
    await clearPrivateData(db)
    await clearBookmarks(db)
  })

  afterAll(async () => {
    await network.close()
  })

  const get = async (actor: string, limit?: number, cursor?: string) =>
    agent.app.bsky.bookmark.getBookmarks(
      { limit, cursor },
      {
        headers: await network.serviceHeaders(
          actor,
          ids.AppBskyBookmarkGetBookmarks,
        ),
      },
    )

  const create = async (actor: string, ref: RecordRef) =>
    agent.app.bsky.bookmark.createBookmark(
      { cid: ref.cidStr, uri: ref.uriStr },
      {
        headers: await network.serviceHeaders(
          actor,
          ids.AppBskyBookmarkCreateBookmark,
        ),
      },
    )

  const del = async (actor: string, ref: RecordRef) =>
    agent.app.bsky.bookmark.deleteBookmark(
      { uri: ref.uriStr },
      {
        headers: await network.serviceHeaders(
          actor,
          ids.AppBskyBookmarkDeleteBookmark,
        ),
      },
    )

  const getPost = async (actor: string, ref: RecordRef) => {
    const { data } = await agent.app.bsky.feed.getPosts(
      { uris: [ref.uriStr] },
      {
        headers: await network.serviceHeaders(actor, ids.AppBskyFeedGetPosts),
      },
    )

    return data.posts[0]
  }

  describe('creation', () => {
    it('creates bookmarks', async () => {
      await create(alice, sc.posts[alice][0].ref)
      await create(alice, sc.posts[bob][0].ref)
      await create(alice, sc.posts[carol][0].ref)

      await create(bob, sc.posts[bob][0].ref)
      await create(bob, sc.posts[carol][0].ref)

      const { data: dataAlice } = await get(alice)
      expect(dataAlice.bookmarks).toHaveLength(3)

      const { data: dataBob } = await get(bob)
      expect(dataBob.bookmarks).toHaveLength(2)
    })

    it('is idempotent', async () => {
      const uri = sc.posts[alice][0].ref

      await create(alice, uri)
      const { data: data0 } = await get(alice)
      expect(data0.bookmarks).toHaveLength(1)

      await create(alice, uri)
      const { data: data1 } = await get(alice)
      expect(data1.bookmarks).toHaveLength(1)
    })

    it('fails on unsupported collections', async () => {
      const followRef = sc.follows[alice][bob]
      await expect(create(alice, followRef)).rejects.toThrow(
        AppBskyBookmarkCreateBookmark.UnsupportedCollectionError,
      )
    })
  })

  describe('deletion', () => {
    it('removes bookmarks', async () => {
      await create(alice, sc.posts[alice][0].ref)
      await create(alice, sc.posts[bob][0].ref)
      await create(alice, sc.posts[carol][0].ref)

      const { data: dataBefore } = await get(alice)
      expect(dataBefore.bookmarks).toHaveLength(3)

      await del(alice, sc.posts[alice][0].ref)
      await del(alice, sc.posts[carol][0].ref)

      const { data: dataAfter } = await get(alice)
      expect(dataAfter.bookmarks).toHaveLength(1)
    })

    it('is idempotent', async () => {
      const uri = sc.posts[alice][0].ref
      await create(alice, uri)

      await del(alice, uri)
      const { data: data0 } = await get(alice)
      expect(data0.bookmarks).toHaveLength(0)

      await del(alice, uri)
      const { data: data1 } = await get(alice)
      expect(data1.bookmarks).toHaveLength(0)
    })

    it('fails on unsupported collections', async () => {
      const followRef = sc.follows[alice][bob]
      await expect(del(alice, followRef)).rejects.toThrow(
        AppBskyBookmarkDeleteBookmark.UnsupportedCollectionError,
      )
    })
  })

  describe('listing', () => {
    it('gets empty bookmarks', async () => {
      const { data } = await get(alice)
      expect(data.bookmarks).toHaveLength(0)
    })

    it('includes the bookmarked viewer state', async () => {
      const ref = sc.posts[bob][0].ref

      const postBefore = await getPost(alice, ref)
      expect(postBefore.viewer?.bookmarked).toBe(false)

      await create(alice, ref)
      const postAfterCreate = await getPost(alice, ref)
      expect(postAfterCreate.viewer?.bookmarked).toBe(true)
      const postAfterCreateForBob = await getPost(bob, ref)
      expect(postAfterCreateForBob.viewer?.bookmarked).toBe(false)

      await del(alice, ref)
      const postAfterDel = await getPost(alice, ref)
      expect(postAfterDel.viewer?.bookmarked).toBe(false)
    })

    it('includes the bookmark counts', async () => {
      const uri = sc.posts[bob][0].ref

      const postBefore = await getPost(alice, uri)
      expect(postBefore.bookmarkCount).toBe(0)

      await create(alice, uri)
      await create(carol, uri)
      const postAfterCreate = await getPost(alice, uri)
      expect(postAfterCreate.bookmarkCount).toBe(2)
      const postAfterCreateForBob = await getPost(bob, uri)
      expect(postAfterCreateForBob.bookmarkCount).toBe(2)

      await del(alice, uri)
      const postAfterAliceDel = await getPost(alice, uri)
      expect(postAfterAliceDel.bookmarkCount).toBe(1)

      await del(carol, uri)
      const postAfterCarolDel = await getPost(carol, uri)
      expect(postAfterCarolDel.bookmarkCount).toBe(0)
    })

    it('paginates bookmarks in descending order', async () => {
      await create(alice, sc.posts[alice][0].ref)
      await create(alice, sc.posts[alice][1].ref)
      await create(alice, sc.posts[bob][0].ref)
      await create(alice, sc.posts[bob][1].ref)
      await create(alice, sc.posts[carol][0].ref)
      await create(alice, sc.posts[dan][0].ref)
      await create(alice, sc.posts[dan][1].ref)

      const results = (out: GetBookmarksOutputSchema[]) =>
        out.flatMap((res) => res.bookmarks)

      const paginator = async (cursor?: string) => {
        const res = await get(alice, 2, cursor)
        return res.data
      }

      const fullRes = await get(alice)
      expect(fullRes.data.bookmarks.length).toBe(7)

      const paginatedRes = await paginateAll(paginator)
      paginatedRes.forEach((res) =>
        expect(res.bookmarks.length).toBeLessThanOrEqual(2),
      )

      const full = results([fullRes.data])
      assertPostViews(full)

      const paginated = results(paginatedRes)
      assertPostViews(paginated)

      // Check items are the same.
      const sort = (
        a: { item: $Typed<PostView> },
        b: { item: $Typed<PostView> },
      ) => (a.item.uri > b.item.uri ? 1 : -1)
      expect([...paginated].sort(sort)).toEqual([...full].sort(sort))

      // Check pagination ordering.
      expect(paginated.at(0)?.subject).toStrictEqual({
        uri: sc.posts[dan][1].ref.uriStr,
        cid: sc.posts[dan][1].ref.cidStr,
      })
      expect(paginated.at(-1)?.subject).toStrictEqual({
        uri: sc.posts[alice][0].ref.uriStr,
        cid: sc.posts[alice][0].ref.cidStr,
      })
    })

    it('shows posts and blocked posts correctly', async () => {
      await create(alice, sc.posts[alice][0].ref)
      await create(alice, sc.posts[bob][0].ref)
      await create(alice, sc.posts[carol][0].ref)

      await create(bob, sc.posts[alice][0].ref)
      await create(bob, sc.posts[carol][0].ref)

      await sc.block(alice, bob)
      await network.processAll()

      const {
        data: { bookmarks: bookmarksA },
      } = await get(alice)
      expect(bookmarksA).toHaveLength(3)
      expect(bookmarksA[0].item.$type).toBe('app.bsky.feed.defs#postView')
      expect(bookmarksA[1].item.$type).toBe('app.bsky.feed.defs#blockedPost')
      expect(bookmarksA[2].item.$type).toBe('app.bsky.feed.defs#postView')
      expect(forSnapshot(bookmarksA)).toMatchSnapshot()

      const {
        data: { bookmarks: bookmarksB },
      } = await get(bob)
      expect(bookmarksB).toHaveLength(2)
      expect(bookmarksB[0].item.$type).toBe('app.bsky.feed.defs#postView')
      expect(bookmarksB[1].item.$type).toBe('app.bsky.feed.defs#blockedPost')
      expect(forSnapshot(bookmarksB)).toMatchSnapshot()
    })
  })
})

const clearPrivateData = async (db: Database) => {
  await db.db.deleteFrom('private_data').execute()
}

const clearBookmarks = async (db: Database) => {
  await db.db.deleteFrom('bookmark').execute()
}

function assertPostViews(
  bookmarks: GetBookmarksOutputSchema['bookmarks'],
): asserts bookmarks is (BookmarkView & { item: $Typed<PostView> })[] {
  bookmarks.forEach((b) => {
    assert(
      AppBskyFeedDefs.isPostView(b.item),
      `Expected bookmark to be a post view`,
    )
  })
}
