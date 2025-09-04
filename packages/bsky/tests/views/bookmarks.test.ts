import assert from 'node:assert'
import {
  $Typed,
  AppBskyBookmarkCreateBookmark,
  AppBskyBookmarkDeleteBookmark,
  AppBskyFeedDefs,
  AtpAgent,
} from '@atproto/api'
import { RecordRef, SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { AuthRequiredError } from '@atproto/xrpc-server'
import { ids } from '../../src/lexicon/lexicons'
import { BookmarkView } from '../../src/lexicon/types/app/bsky/bookmark/defs'
import { OutputSchema as GetBookmarksOutputSchema } from '../../src/lexicon/types/app/bsky/bookmark/getBookmarks'
import { OutputSchema as GetModBookmarksByActorOutputSchema } from '../../src/lexicon/types/app/bsky/bookmark/getModBookmarksByActor'
import {
  Bookmark as BookmarkActor,
  OutputSchema as GetModBookmarksBySubjectOutputSchema,
} from '../../src/lexicon/types/app/bsky/bookmark/getModBookmarksBySubject'
import { PostView } from '../../src/lexicon/types/app/bsky/feed/defs'
import { forSnapshot, paginateAll } from '../_util'

type Database = TestNetwork['bsky']['db']
type PostViewBookmark = { item: $Typed<PostView> }

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
  let eve: string
  let ozone: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_bookmarks',
    })
    db = network.bsky.db
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await sc.createAccount('eve', {
      handle: 'eve.test',
      email: 'eve@eve.com',
      password: 'hunter2',
    })
    await network.processAll()

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    eve = sc.dids.eve

    ozone = network.ozone.ctx.cfg.service.did
  })

  afterEach(async () => {
    jest.resetAllMocks()
    await clearPrivateData(db)
    await clearBookmarks(db)
  })

  afterAll(async () => {
    await network.close()
  })

  const sortBookmarkActors = (a: BookmarkActor, b: BookmarkActor) =>
    a.actor.did > b.actor.did ? 1 : -1

  const sortBookmarks = (a: PostViewBookmark, b: PostViewBookmark) =>
    a.item.uri > b.item.uri ? 1 : -1

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

  const getModByActor = async (
    serviceDid: string,
    actor: string,
    limit?: number,
    cursor?: string,
  ) =>
    agent.app.bsky.bookmark.getModBookmarksByActor(
      { actor, limit, cursor },
      {
        headers: await network.serviceHeaders(
          serviceDid,
          ids.AppBskyBookmarkGetModBookmarksByActor,
        ),
      },
    )

  const getModBySubject = async (
    serviceDid: string,
    ref: RecordRef,
    limit?: number,
    cursor?: string,
  ) =>
    agent.app.bsky.bookmark.getModBookmarksBySubject(
      { subject: ref.uriStr, limit, cursor },
      {
        headers: await network.serviceHeaders(
          serviceDid,
          ids.AppBskyBookmarkGetModBookmarksBySubject,
        ),
      },
    )

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
      expect([...paginated].sort(sortBookmarks)).toEqual(
        [...full].sort(sortBookmarks),
      )

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

    describe('blocks', () => {
      afterEach(async () => {
        await sc.unblock(alice, bob)
        await network.processAll()
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

  describe('moderation', () => {
    describe('get bookmarks by actor', () => {
      it('only allows moderation service to access', async () => {
        // alice can get own bookmarks.
        const res0 = await get(alice)
        expect(res0.success).toBe(true)

        // moderation can get alice's bookmarks.
        const res1 = await getModByActor(ozone, alice)
        expect(res1.success).toBe(true)

        // alice cannot get bookmarks via moderation endpoint.
        await expect(getModByActor(alice, alice)).rejects.toThrow(
          new AuthRequiredError('Untrusted issuer', 'UntrustedIss'),
        )
      })

      it('gets the same bookmarks as author', async () => {
        await create(alice, sc.posts[alice][0].ref)
        await create(alice, sc.posts[bob][0].ref)
        await create(alice, sc.posts[carol][0].ref)

        const {
          data: { bookmarks },
        } = await get(alice)
        const {
          data: { bookmarks: bookmarksMod },
        } = await getModByActor(ozone, alice)

        assertPostViews(bookmarks)
        assertPostViews(bookmarksMod)
        const pluckUri = (p: PostViewBookmark): string => p.item.uri
        const bookmarkUris = bookmarks.sort(sortBookmarks).map(pluckUri)
        const bookmarkModUris = bookmarksMod.sort(sortBookmarks).map(pluckUri)
        expect(bookmarkUris).toEqual(bookmarkModUris)
      })

      it('paginates bookmarks in descending order', async () => {
        await create(alice, sc.posts[alice][0].ref)
        await create(alice, sc.posts[alice][1].ref)
        await create(alice, sc.posts[bob][0].ref)
        await create(alice, sc.posts[bob][1].ref)
        await create(alice, sc.posts[carol][0].ref)
        await create(alice, sc.posts[dan][0].ref)
        await create(alice, sc.posts[dan][1].ref)

        const results = (out: GetModBookmarksByActorOutputSchema[]) =>
          out.flatMap((res) => res.bookmarks)

        const paginator = async (cursor?: string) => {
          const res = await getModByActor(ozone, alice, 2, cursor)
          return res.data
        }

        const fullRes = await getModByActor(ozone, alice)
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
        expect([...paginated].sort(sortBookmarks)).toEqual(
          [...full].sort(sortBookmarks),
        )

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
    })

    describe('get bookmarks by subject', () => {
      it('only allows moderation service to access', async () => {
        const subjectRef = sc.posts[alice][0].ref

        // moderation can get post's bookmarks.
        const res1 = await getModBySubject(ozone, subjectRef)
        expect(res1.success).toBe(true)

        // alice cannot get bookmarks via moderation endpoint.
        await expect(getModBySubject(alice, subjectRef)).rejects.toThrow(
          new AuthRequiredError('Untrusted issuer', 'UntrustedIss'),
        )
      })

      it('gets actors who bookmarked', async () => {
        const subjectRef = sc.posts[alice][0].ref
        await create(alice, subjectRef)
        await create(bob, subjectRef)
        await create(carol, subjectRef)

        const {
          data: { bookmarks },
        } = await getModBySubject(ozone, subjectRef)

        expect(bookmarks).toHaveLength(3)
        expect(forSnapshot(bookmarks)).toMatchSnapshot()
      })

      it('paginates actors who bookmarked, in descending order', async () => {
        const subjectRef = sc.posts[alice][0].ref
        await create(alice, subjectRef)
        await create(bob, subjectRef)
        await create(carol, subjectRef)
        await create(dan, subjectRef)
        await create(eve, subjectRef)

        const results = (out: GetModBookmarksBySubjectOutputSchema[]) =>
          out.flatMap((res) => res.bookmarks)

        const paginator = async (cursor?: string) => {
          const res = await getModBySubject(ozone, subjectRef, 2, cursor)
          return res.data
        }

        const fullRes = await getModBySubject(ozone, subjectRef)
        expect(fullRes.data.bookmarks.length).toBe(5)

        const paginatedRes = await paginateAll(paginator)
        paginatedRes.forEach((res) =>
          expect(res.bookmarks.length).toBeLessThanOrEqual(2),
        )

        const full = results([fullRes.data])
        const paginated = results(paginatedRes)

        // Check items are the same.
        expect([...paginated].sort(sortBookmarkActors)).toEqual(
          [...full].sort(sortBookmarkActors),
        )

        // Check pagination ordering.
        expect(paginated.at(0)?.actor).toMatchObject({
          did: eve,
        })
        expect(paginated.at(-1)?.actor).toMatchObject({
          did: alice,
        })
      })
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
): asserts bookmarks is (BookmarkView & PostViewBookmark)[] {
  bookmarks.forEach((b) => {
    assert(
      AppBskyFeedDefs.isPostView(b.item),
      `Expected bookmark to be a post view`,
    )
  })
}
