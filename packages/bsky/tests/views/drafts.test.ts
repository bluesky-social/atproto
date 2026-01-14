import { AppBskyDraftCreateDraft, AtpAgent } from '@atproto/api'
import { TID } from '@atproto/common'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import {
  Draft,
  DraftView,
  DraftWithId,
} from '../../src/lexicon/types/app/bsky/draft/defs'
import { OutputSchema as GetDraftsOutputSchema } from '../../src/lexicon/types/app/bsky/draft/getDrafts'
import { paginateAll } from '../_util'

type Database = TestNetwork['bsky']['db']

const LIMIT = 10

describe('appview drafts views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let db: Database

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
    db = network.bsky.db
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()

    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterEach(async () => {
    jest.resetAllMocks()
    await clearDrafts(db)
  })

  afterAll(async () => {
    await network.close()
  })

  const makeDraft = (): Draft => ({
    posts: [{ text: 'Hello, world!' }],
  })

  const get = async (actor: string, limit?: number, cursor?: string) =>
    agent.app.bsky.draft.getDrafts(
      { limit, cursor },
      {
        headers: await network.serviceHeaders(actor, ids.AppBskyDraftGetDrafts),
      },
    )

  const create = async (actor: string, draft: Draft) =>
    agent.app.bsky.draft.createDraft(
      { draft },
      {
        headers: await network.serviceHeaders(
          actor,
          ids.AppBskyDraftCreateDraft,
        ),
      },
    )

  const update = async (actor: string, draftWithId: DraftWithId) =>
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

      const { data: dataAlice } = await get(alice)
      expect(dataAlice.drafts).toHaveLength(3)

      const { data: dataBob } = await get(bob)
      expect(dataBob.drafts).toHaveLength(2)
    })

    it('creates drafts with multiple posts (threads)', async () => {
      const draft: Draft = {
        posts: [
          { text: 'First post in thread' },
          { text: 'Second post in thread' },
          { text: 'Third post in thread' },
        ],
      }

      await create(alice, draft)
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
      const draft1: Draft = { posts: [{ text: 'First version' }] }

      await create(alice, draft1)
      const { data: data0 } = await get(alice)
      expect(data0.drafts).toHaveLength(1)
      expect(data0.drafts[0].draft.posts[0].text).toBe('First version')

      const draftId = data0.drafts[0].id
      const draft2: DraftWithId = {
        id: draftId,
        draft: { posts: [{ text: 'Updated version' }] },
      }

      await update(alice, draft2)
      const { data: data1 } = await get(alice)
      expect(data1.drafts).toHaveLength(1)
      expect(data1.drafts[0].draft.posts[0].text).toBe('Updated version')
    })

    it('silently ignores updates to non-existing drafts', async () => {
      const nonExistingDraft: DraftWithId = {
        id: TID.nextStr(),
        draft: { posts: [{ text: 'This draft does not exist' }] },
      }

      await update(alice, nonExistingDraft)
      const { data } = await get(alice)
      expect(data.drafts).toHaveLength(0)
    })
  })

  describe('deletion', () => {
    it('removes drafts', async () => {
      await create(alice, makeDraft())
      await create(alice, makeDraft())
      await create(alice, makeDraft())

      const { data: dataBefore } = await get(alice)
      expect(dataBefore.drafts).toHaveLength(3)

      const draft1Id = dataBefore.drafts[0].id
      const draft2Id = dataBefore.drafts[1].id
      const draft3Id = dataBefore.drafts[2].id

      await del(alice, draft1Id)
      await del(alice, draft3Id)

      const { data: dataAfter } = await get(alice)
      expect(dataAfter.drafts).toHaveLength(1)
      expect(dataAfter.drafts[0].id).toBe(draft2Id)
    })

    it('is idempotent', async () => {
      await create(alice, makeDraft())

      const { data: data0 } = await get(alice)
      expect(data0.drafts).toHaveLength(1)
      const draftId = data0.drafts[0].id

      await del(alice, draftId)
      const { data: data1 } = await get(alice)
      expect(data1.drafts).toHaveLength(0)

      await del(alice, draftId)
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

      const { data: dataAlice } = await get(alice)
      expect(dataAlice.drafts).toHaveLength(2)

      const { data: dataBob } = await get(bob)
      expect(dataBob.drafts).toHaveLength(1)
    })

    it('includes timestamps', async () => {
      const beforeCreate = new Date()
      await create(alice, makeDraft())
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

      const results = (out: GetDraftsOutputSchema[]) =>
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
      const sort = (a: DraftView, b: DraftView) => (a.id > b.id ? 1 : -1)
      expect([...paginated].sort(sort)).toEqual([...full].sort(sort))

      // Check pagination ordering (most recent first).
      expect(paginated.at(0)?.id).toBe(full.at(0)?.id)
      expect(paginated.at(-1)?.id).toBe(full.at(-1)?.id)
    })
  })
})

const clearDrafts = async (db: Database) => {
  await db.db.deleteFrom('draft').execute()
}
