import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  type $Typed,
  AppBskyDraftCreateDraft,
  AppBskyDraftDefs,
  type AppBskyDraftGetDrafts,
  type AtpAgent,
  ids,
} from '@atproto/api'
import { TID } from '@atproto/common'
import { TestNetwork, basicSeed } from '@atproto/dev-env'
import { paginateAll } from '../_util.js'

type Database = TestNetwork['bsky']['db']

const LIMIT = 10

describe('appview drafts views', () => {
  let network: TestNetwork
  let agent: AtpAgent

  // account dids, for convenience
  let alice: string
  let bob: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_drafts',
      bsky: {
        draftsLimit: LIMIT,
      },
    })
    agent = network.bsky.getAgent()
    const sc = network.getSeedClient()
    await basicSeed(sc)

    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  beforeEach(async () => network.processAll())
  afterEach(async () => {
    vi.resetAllMocks()
    // Drain in-flight bsync operations before resetting state directly,
    // otherwise a late-applied op can resurrect state after the reset.
    await network.processAll()
    await clearDrafts(network.bsky.db)
  })
  afterAll(async () => network?.close())

  const makeDraft = (): AppBskyDraftDefs.Draft => ({
    posts: [{ text: 'Hello, world!' }],
  })

  const get = async (actor: string, limit?: number, cursor?: string) =>
    agent.app.bsky.draft.getDrafts(
      { limit, cursor },
      {
        headers: await network.serviceHeaders(actor, ids.AppBskyDraftGetDrafts),
      },
    )

  const create = async (actor: string, draft: AppBskyDraftDefs.Draft) =>
    agent.app.bsky.draft.createDraft(
      { draft },
      {
        headers: await network.serviceHeaders(
          actor,
          ids.AppBskyDraftCreateDraft,
        ),
      },
    )

  const update = async (
    actor: string,
    draftWithId: AppBskyDraftDefs.DraftWithId,
  ) =>
    agent.app.bsky.draft.updateDraft(
      { draft: draftWithId },
      {
        headers: await network.serviceHeaders(
          actor,
          ids.AppBskyDraftUpdateDraft,
        ),
      },
    )

  const del = async (actor: string, id: string) =>
    agent.app.bsky.draft.deleteDraft(
      { id },
      {
        headers: await network.serviceHeaders(
          actor,
          ids.AppBskyDraftDeleteDraft,
        ),
      },
    )

  describe('creation', () => {
    it('creates drafts', async () => {
      const res1 = await create(alice, makeDraft())
      const res2 = await create(alice, makeDraft())
      const res3 = await create(alice, makeDraft())

      expect(res1.data.id).toBeDefined()
      expect(res2.data.id).toBeDefined()
      expect(res3.data.id).toBeDefined()
      expect(new Set([res1.data.id, res2.data.id, res3.data.id]).size).toBe(3)

      await create(bob, makeDraft())
      await create(bob, makeDraft())
      await network.processAll()

      const { data: dataAlice } = await get(alice)
      expect(dataAlice.drafts).toHaveLength(3)

      const { data: dataBob } = await get(bob)
      expect(dataBob.drafts).toHaveLength(2)
    })

    it('creates drafts with multiple posts (threads)', async () => {
      const draft: AppBskyDraftDefs.Draft = {
        posts: [
          { text: 'First post in thread' },
          { text: 'Second post in thread' },
          { text: 'Third post in thread' },
        ],
      }

      await create(alice, draft)
      await network.processAll()
      const { data } = await get(alice)
      expect(data.drafts).toHaveLength(1)
      expect(data.drafts[0].draft.posts).toHaveLength(3)
      expect(data.drafts[0].draft.posts[0].text).toBe('First post in thread')
      expect(data.drafts[0].draft.posts[2].text).toBe('Third post in thread')
    })

    it('limits the drafts', async () => {
      // Consume the limit.
      for (let i = 0; i < LIMIT; i++) {
        await create(alice, makeDraft())
        await network.processAll()
      }

      // Try to go over the limit.
      await expect(create(alice, makeDraft())).rejects.toThrow(
        AppBskyDraftCreateDraft.DraftLimitReachedError,
      )
    })
  })

  describe('update', () => {
    it('updates an existing draft', async () => {
      const draft1: AppBskyDraftDefs.Draft = {
        posts: [{ text: 'First version' }],
      }

      await create(alice, draft1)
      await network.processAll()
      const { data: data0 } = await get(alice)
      expect(data0.drafts).toHaveLength(1)
      expect(data0.drafts[0].draft.posts[0].text).toBe('First version')

      const draftId = data0.drafts[0].id
      const draft2: AppBskyDraftDefs.DraftWithId = {
        id: draftId,
        draft: { posts: [{ text: 'Updated version' }] },
      }

      await update(alice, draft2)
      await network.processAll()
      const { data: data1 } = await get(alice)
      expect(data1.drafts).toHaveLength(1)
      expect(data1.drafts[0].draft.posts[0].text).toBe('Updated version')
    })

    it('silently ignores updates to non-existing drafts', async () => {
      const nonExistingDraft: AppBskyDraftDefs.DraftWithId = {
        id: TID.nextStr(),
        draft: { posts: [{ text: 'This draft does not exist' }] },
      }

      await update(alice, nonExistingDraft)
      await network.processAll()
      const { data } = await get(alice)
      expect(data.drafts).toHaveLength(0)
    })
  })

  describe('deletion', () => {
    it('removes drafts', async () => {
      await create(alice, makeDraft())
      await create(alice, makeDraft())
      await create(alice, makeDraft())
      await network.processAll()

      const { data: dataBefore } = await get(alice)
      expect(dataBefore.drafts).toHaveLength(3)

      const draft1Id = dataBefore.drafts[0].id
      const draft2Id = dataBefore.drafts[1].id
      const draft3Id = dataBefore.drafts[2].id

      await del(alice, draft1Id)
      await del(alice, draft3Id)
      await network.processAll()

      const { data: dataAfter } = await get(alice)
      expect(dataAfter.drafts).toHaveLength(1)
      expect(dataAfter.drafts[0].id).toBe(draft2Id)
    })

    it('is idempotent', async () => {
      await create(alice, makeDraft())
      await network.processAll()

      const { data: data0 } = await get(alice)
      expect(data0.drafts).toHaveLength(1)
      const draftId = data0.drafts[0].id

      await del(alice, draftId)
      await network.processAll()
      const { data: data1 } = await get(alice)
      expect(data1.drafts).toHaveLength(0)

      await del(alice, draftId)
      await network.processAll()
      const { data: data2 } = await get(alice)
      expect(data2.drafts).toHaveLength(0)
    })
  })

  describe('listing', () => {
    it('gets empty drafts', async () => {
      const { data } = await get(alice)
      expect(data.drafts).toHaveLength(0)
    })

    it('drafts are private to each user', async () => {
      await create(alice, makeDraft())
      await create(alice, makeDraft())
      await create(bob, makeDraft())
      await network.processAll()

      const { data: dataAlice } = await get(alice)
      expect(dataAlice.drafts).toHaveLength(2)

      const { data: dataBob } = await get(bob)
      expect(dataBob.drafts).toHaveLength(1)
    })

    it('includes timestamps', async () => {
      const beforeCreate = new Date()
      await create(alice, makeDraft())
      await network.processAll()
      const afterCreate = new Date()

      const { data } = await get(alice)
      expect(data.drafts).toHaveLength(1)

      const createdAt = new Date(data.drafts[0].createdAt)
      expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())

      const updatedAt = new Date(data.drafts[0].updatedAt)
      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
    })

    it('paginates drafts in descending order', async () => {
      for (let i = 0; i < 7; i++) {
        await create(alice, makeDraft())
      }
      await network.processAll()

      const results = (out: AppBskyDraftGetDrafts.OutputSchema[]) =>
        out.flatMap((res) => res.drafts)

      const paginator = async (cursor?: string) => {
        const res = await get(alice, 2, cursor)
        return res.data
      }

      const fullRes = await get(alice)
      expect(fullRes.data.drafts.length).toBe(7)

      const paginatedRes = await paginateAll(paginator)
      paginatedRes.forEach((res) =>
        expect(res.drafts.length).toBeLessThanOrEqual(2),
      )

      const full = results([fullRes.data])
      const paginated = results(paginatedRes)

      // Check items are the same.
      const sort = (
        a: AppBskyDraftDefs.DraftView,
        b: AppBskyDraftDefs.DraftView,
      ) => (a.id > b.id ? 1 : -1)
      expect([...paginated].sort(sort)).toEqual([...full].sort(sort))

      // Check pagination ordering (most recent first).
      expect(paginated.at(0)?.id).toBe(full.at(0)?.id)
      expect(paginated.at(-1)?.id).toBe(full.at(-1)?.id)
    })
  })

  describe('gallery embed', () => {
    const galleryItem = (
      i: number,
    ): $Typed<AppBskyDraftDefs.DraftEmbedImage> => ({
      $type: 'app.bsky.draft.defs#draftEmbedImage',
      localRef: { path: `/local/img-${i}.jpg` },
      alt: `image ${i}`,
    })

    const galleryDraft = (size: number): AppBskyDraftDefs.Draft => ({
      posts: [
        {
          text: 'gallery draft',
          embedGallery: {
            items: Array.from({ length: size }, (_, i) => galleryItem(i)),
          },
        },
      ],
    })

    it('round-trips a draft with embedGallery', async () => {
      await create(alice, galleryDraft(3))
      await network.processAll()
      const { data } = await get(alice)
      expect(data.drafts).toHaveLength(1)

      const post = data.drafts[0].draft.posts[0]
      expect(post.embedGallery?.items).toHaveLength(3)
      post.embedGallery?.items.forEach((item, i) => {
        expect(item.$type).toBe('app.bsky.draft.defs#draftEmbedImage')
        if (AppBskyDraftDefs.isDraftEmbedImage(item)) {
          expect(item.localRef.path).toBe(`/local/img-${i}.jpg`)
          expect(item.alt).toBe(`image ${i}`)
        }
      })
    })

    it('updates a draft to add a gallery', async () => {
      await create(alice, { posts: [{ text: 'text only' }] })
      await network.processAll()
      const { data: before } = await get(alice)
      expect(before.drafts).toHaveLength(1)
      expect(before.drafts[0].draft.posts[0].embedGallery).toBeUndefined()

      const draftId = before.drafts[0].id
      await update(alice, {
        id: draftId,
        draft: galleryDraft(2),
      })
      await network.processAll()

      const { data: after } = await get(alice)
      expect(after.drafts).toHaveLength(1)
      expect(after.drafts[0].id).toBe(draftId)
      expect(after.drafts[0].draft.posts[0].embedGallery?.items).toHaveLength(2)
    })

    it('updates a draft to change gallery items', async () => {
      await create(alice, galleryDraft(2))
      await network.processAll()
      const { data: before } = await get(alice)
      expect(before.drafts[0].draft.posts[0].embedGallery?.items).toHaveLength(
        2,
      )

      const draftId = before.drafts[0].id
      await update(alice, {
        id: draftId,
        draft: galleryDraft(5),
      })
      await network.processAll()

      const { data: after } = await get(alice)
      const post = after.drafts[0].draft.posts[0]
      expect(post.embedGallery?.items).toHaveLength(5)
      // Confirm full replacement (new items 0..4, not appended onto old 0..1).
      post.embedGallery?.items.forEach((item, i) => {
        if (AppBskyDraftDefs.isDraftEmbedImage(item)) {
          expect(item.localRef.path).toBe(`/local/img-${i}.jpg`)
        }
      })
    })

    it('rejects embedGallery.items exceeding maxLength=20', async () => {
      await expect(create(alice, galleryDraft(21))).rejects.toThrow()
    })

    it('rejects gallery items without $type', async () => {
      const badDraft = {
        posts: [
          {
            text: 'gallery without $type',
            embedGallery: {
              items: [
                // Union members must be $type-tagged. Cast away types so the
                // request reaches the server, where lex validation rejects it.
                {
                  localRef: { path: '/local/untagged.jpg' },
                  alt: 'untagged',
                } as unknown as $Typed<AppBskyDraftDefs.DraftEmbedImage>,
              ],
            },
          },
        ],
      }
      await expect(create(alice, badDraft)).rejects.toThrow()
    })
  })
})

const clearDrafts = async (db: Database) => {
  await db.db.deleteFrom('draft').execute()
}
