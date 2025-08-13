import assert from 'node:assert'
import {
  $Typed,
  AppBskyBookmarkCreateBookmark,
  AppBskyBookmarkDeleteBookmark,
  AppBskyFeedDefs,
  AtpAgent,
} from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
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

  const create = async (actor: string, uri: string) =>
    agent.app.bsky.bookmark.createBookmark(
      { uri },
      {
        headers: await network.serviceHeaders(
          actor,
          ids.AppBskyBookmarkCreateBookmark,
        ),
      },
    )

  const del = async (actor: string, uri: string) =>
    agent.app.bsky.bookmark.deleteBookmark(
      { uri },
      {
        headers: await network.serviceHeaders(
          actor,
          ids.AppBskyBookmarkDeleteBookmark,
        ),
      },
    )

  describe('creation', () => {
    it('creates bookmarks', async () => {
      await create(alice, sc.posts[alice][0].ref.uriStr)
      await create(alice, sc.posts[bob][0].ref.uriStr)
      await create(alice, sc.posts[carol][0].ref.uriStr)

      await create(bob, sc.posts[bob][0].ref.uriStr)
      await create(bob, sc.posts[carol][0].ref.uriStr)

      const { data: dataAlice } = await get(alice)
      expect(dataAlice.bookmarks).toHaveLength(3)

      const { data: dataBob } = await get(bob)
      expect(dataBob.bookmarks).toHaveLength(2)
    })

    it('fails on dupes', async () => {
      const uri = sc.posts[alice][0].ref.uriStr
      await create(alice, uri)
      await expect(create(alice, uri)).rejects.toThrow(
        AppBskyBookmarkCreateBookmark.DuplicatedError,
      )
    })

    it('fails on unsupported collections', async () => {
      const followUri = sc.follows[alice][bob].uriStr
      await expect(create(alice, followUri)).rejects.toThrow(
        AppBskyBookmarkCreateBookmark.UnsupportedCollectionError,
      )
    })
  })

  describe('deletion', () => {
    it('removes bookmarks', async () => {
      await create(alice, sc.posts[alice][0].ref.uriStr)
      await create(alice, sc.posts[bob][0].ref.uriStr)
      await create(alice, sc.posts[carol][0].ref.uriStr)

      const { data: dataBefore } = await get(alice)
      expect(dataBefore.bookmarks).toHaveLength(3)

      await del(alice, sc.posts[alice][0].ref.uriStr)
      await del(alice, sc.posts[carol][0].ref.uriStr)

      const { data: dataAfter } = await get(alice)
      expect(dataAfter.bookmarks).toHaveLength(1)
    })

    it('fails on not found', async () => {
      const uri = sc.posts[alice][0].ref.uriStr
      await expect(del(alice, uri)).rejects.toThrow(
        AppBskyBookmarkDeleteBookmark.NotFoundError,
      )
    })

    it('fails on unsupported collections', async () => {
      const followUri = sc.follows[alice][bob].uriStr
      await expect(del(alice, followUri)).rejects.toThrow(
        AppBskyBookmarkDeleteBookmark.UnsupportedCollectionError,
      )
    })
  })

  describe('listing', () => {
    it('gets empty bookmarks', async () => {
      const { data } = await get(alice)
      expect(data.bookmarks).toHaveLength(0)
    })

    it('paginates bookmarks', async () => {
      await create(alice, sc.posts[alice][0].ref.uriStr)
      await create(alice, sc.posts[alice][1].ref.uriStr)
      await create(alice, sc.posts[bob][0].ref.uriStr)
      await create(alice, sc.posts[bob][1].ref.uriStr)
      await create(alice, sc.posts[carol][0].ref.uriStr)
      await create(alice, sc.posts[dan][0].ref.uriStr)
      await create(alice, sc.posts[dan][1].ref.uriStr)

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

      const sort = (
        a: { item: $Typed<PostView> },
        b: { item: $Typed<PostView> },
      ) => (a.item.uri > b.item.uri ? 1 : -1)
      expect(paginated.sort(sort)).toEqual(full.sort(sort))
    })

    it('removes entries by blocked users, bidirectionally', async () => {
      await create(alice, sc.posts[alice][0].ref.uriStr)
      await create(alice, sc.posts[bob][0].ref.uriStr)
      await create(alice, sc.posts[carol][0].ref.uriStr)

      await create(bob, sc.posts[alice][0].ref.uriStr)
      await create(bob, sc.posts[carol][0].ref.uriStr)

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
): asserts bookmarks is { item: $Typed<AppBskyFeedDefs.PostView> }[] {
  bookmarks.forEach((b) => {
    assert(
      AppBskyFeedDefs.isPostView(b.item),
      `Expected bookmark to be a post view`,
    )
  })
}
