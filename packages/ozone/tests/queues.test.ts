import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'

describe('ozone-queues', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const modHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'admin')

  const triageHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'triage')

  const createQueue = async (
    input: {
      name: string
      subjectTypes: string[]
      reportTypes: string[]
      collection?: string
    },
    role: 'admin' | 'triage' = 'admin',
  ) => {
    const headers =
      role === 'triage'
        ? await triageHeaders(ids.ToolsOzoneQueueCreateQueue)
        : await modHeaders(ids.ToolsOzoneQueueCreateQueue)
    return agent.tools.ozone.queue.createQueue(input, {
      encoding: 'application/json',
      headers,
    })
  }

  const deleteQueue = async (
    queueId: number,
    options: { migrateToQueueId?: number; role?: 'admin' | 'triage' } = {},
  ) => {
    const { migrateToQueueId, role = 'admin' } = options
    const headers =
      role === 'triage'
        ? await triageHeaders(ids.ToolsOzoneQueueDeleteQueue)
        : await modHeaders(ids.ToolsOzoneQueueDeleteQueue)
    return agent.tools.ozone.queue.deleteQueue(
      {
        queueId,
        ...(migrateToQueueId !== undefined ? { migrateToQueueId } : {}),
      },
      {
        encoding: 'application/json',
        headers,
      },
    )
  }

  const listQueues = async (params?: {
    enabled?: boolean
    subjectType?: string
    collection?: string
    reportTypes?: string[]
    limit?: number
    cursor?: string
  }) => {
    const { data } = await agent.tools.ozone.queue.listQueues(params, {
      headers: await modHeaders(ids.ToolsOzoneQueueListQueues),
    })
    return data
  }

  const updateQueue = async (
    input: { queueId: number; name?: string; enabled?: boolean },
    role: 'admin' | 'triage' = 'admin',
  ) => {
    const headers =
      role === 'triage'
        ? await triageHeaders(ids.ToolsOzoneQueueUpdateQueue)
        : await modHeaders(ids.ToolsOzoneQueueUpdateQueue)
    return agent.tools.ozone.queue.updateQueue(input, {
      encoding: 'application/json',
      headers,
    })
  }

  const cleanupQueues = async (ids: number[]) => {
    await Promise.all(ids.map((id) => deleteQueue(id).catch(() => {})))
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_queues',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('createQueue', () => {
    const createdIds: number[] = []

    afterEach(async () => {
      await cleanupQueues(createdIds.splice(0))
    })

    it('creates a queue successfully', async () => {
      const { data } = await createQueue({
        name: 'CQ: Spam Accounts',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
      })
      createdIds.push(data.queue.id)

      expect(data.queue.name).toBe('CQ: Spam Accounts')
      expect(data.queue.subjectTypes).toEqual(['account'])
      expect(data.queue.reportTypes).toEqual([
        'com.atproto.moderation.defs#reasonSpam',
      ])
      expect(data.queue.enabled).toBe(true)
      expect(data.queue.id).toBeDefined()
      expect(data.queue.createdBy).toBeDefined()
      expect(data.queue.createdAt).toBeDefined()
      expect(data.queue.updatedAt).toBeDefined()
      expect(data.queue.stats).toBeDefined()
    })

    it('creates a queue with collection filter', async () => {
      const { data } = await createQueue({
        name: 'CQ: Post Spam',
        subjectTypes: ['record'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
        collection: 'app.bsky.feed.post',
      })
      createdIds.push(data.queue.id)

      expect(data.queue.collection).toBe('app.bsky.feed.post')
    })

    it('rejects creation by non-moderator', async () => {
      await expect(
        createQueue(
          {
            name: 'CQ: Unauthorized Queue',
            subjectTypes: ['account'],
            reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
          },
          'triage',
        ),
      ).rejects.toThrow()
    })

    it('rejects conflicting queue - same subject type and report type', async () => {
      const { data: q1 } = await createQueue({
        name: 'CQ: Harassment Accounts',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonHarassment'],
      })
      createdIds.push(q1.queue.id)

      await expect(
        createQueue({
          name: 'CQ: Harassment Accounts Duplicate',
          subjectTypes: ['account'],
          reportTypes: ['com.atproto.moderation.defs#reasonHarassment'],
        }),
      ).rejects.toMatchObject({ error: 'ConflictingQueue' })
    })

    it('rejects conflicting queue - partial overlap in subject types', async () => {
      const { data: q1 } = await createQueue({
        name: 'CQ: Spam Account Only',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonOther'],
      })
      createdIds.push(q1.queue.id)

      // 'account' overlaps, same collection (null), 'reasonOther' overlaps = conflict
      await expect(
        createQueue({
          name: 'CQ: Spam All',
          subjectTypes: ['account', 'record'],
          reportTypes: ['com.atproto.moderation.defs#reasonOther'],
        }),
      ).rejects.toMatchObject({ error: 'ConflictingQueue' })
    })

    it('rejects conflicting queue - partial overlap in report types', async () => {
      const { data: q1 } = await createQueue({
        name: 'CQ: Mixed Reports',
        subjectTypes: ['account'],
        reportTypes: [
          'com.atproto.moderation.defs#reasonHarassment',
          'com.atproto.moderation.defs#reasonMisleading',
        ],
      })
      createdIds.push(q1.queue.id)

      // reasonHarassment overlaps = conflict
      await expect(
        createQueue({
          name: 'CQ: Just Harassment',
          subjectTypes: ['account'],
          reportTypes: ['com.atproto.moderation.defs#reasonHarassment'],
        }),
      ).rejects.toMatchObject({ error: 'ConflictingQueue' })
    })

    it('allows non-conflicting queues with same report type but different collection', async () => {
      const { data: q1 } = await createQueue({
        name: 'CQ: Spam Posts',
        subjectTypes: ['record'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
        collection: 'app.bsky.feed.post',
      })
      createdIds.push(q1.queue.id)

      // Different collection = no conflict
      const { data: q2 } = await createQueue({
        name: 'CQ: Spam Feeds',
        subjectTypes: ['record'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
        collection: 'app.bsky.feed.generator',
      })
      createdIds.push(q2.queue.id)

      expect(q2.queue.name).toBe('CQ: Spam Feeds')
    })

    it('allows non-conflicting queues with same report type but different subject type', async () => {
      const { data: q1 } = await createQueue({
        name: 'CQ: Record Sexual',
        subjectTypes: ['record'],
        reportTypes: ['com.atproto.moderation.defs#reasonSexual'],
        collection: 'app.bsky.feed.post',
      })
      createdIds.push(q1.queue.id)

      // account vs record = different subject type with collection distinction = no conflict
      const { data: q2 } = await createQueue({
        name: 'CQ: Account Sexual',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonSexual'],
      })
      createdIds.push(q2.queue.id)

      expect(q2.queue.name).toBe('CQ: Account Sexual')
    })
  })

  describe('listQueues', () => {
    let queueIds: number[] = []

    beforeAll(async () => {
      const q1 = await createQueue({
        name: 'LQ: Spam',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
      })
      const q2 = await createQueue({
        name: 'LQ: Harassment',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonHarassment'],
      })
      const q3 = await createQueue({
        name: 'LQ: Sexual Posts',
        subjectTypes: ['record'],
        reportTypes: ['com.atproto.moderation.defs#reasonSexual'],
        collection: 'app.bsky.feed.post',
      })
      queueIds = [q1.data.queue.id, q2.data.queue.id, q3.data.queue.id]
    })

    afterAll(async () => {
      await cleanupQueues(queueIds)
    })

    it('returns all queues', async () => {
      const result = await listQueues()
      expect(result.queues.length).toBeGreaterThanOrEqual(3)
      // Verify our 3 queues are present
      const ourIds = new Set(queueIds)
      const found = result.queues.filter((q) => ourIds.has(q.id))
      expect(found.length).toBe(3)
    })

    it('limits the number of returned queues', async () => {
      const result = await listQueues({ limit: 2 })
      expect(result.queues.length).toBe(2)
      expect(result.cursor).toBeDefined()
    })

    it('paginates correctly', async () => {
      const firstPage = await listQueues({ limit: 2 })
      expect(firstPage.queues.length).toBe(2)
      expect(firstPage.cursor).toBeDefined()

      const secondPage = await listQueues({
        cursor: firstPage.cursor,
        limit: 2,
      })
      expect(secondPage.queues.length).toBeGreaterThanOrEqual(1)

      // No overlap between pages
      const firstPageIds = firstPage.queues.map((q) => q.id)
      const secondPageIds = secondPage.queues.map((q) => q.id)
      expect(firstPageIds.some((id) => secondPageIds.includes(id))).toBe(false)
    })

    it('filters by enabled status', async () => {
      await updateQueue({ queueId: queueIds[0], enabled: false })

      const enabledQueues = await listQueues({ enabled: true })
      const disabledQueues = await listQueues({ enabled: false })

      expect(enabledQueues.queues.every((q) => q.enabled)).toBe(true)
      expect(disabledQueues.queues.every((q) => !q.enabled)).toBe(true)
      expect(disabledQueues.queues.some((q) => q.id === queueIds[0])).toBe(true)

      // Re-enable
      await updateQueue({ queueId: queueIds[0], enabled: true })
    })

    it('filters by subjectType, collection, and reportTypes', async () => {
      // q3 is the only record+post+sexual queue
      const bySubjectType = await listQueues({ subjectType: 'record' })
      expect(
        bySubjectType.queues.every((q) => q.subjectTypes.includes('record')),
      ).toBe(true)
      expect(bySubjectType.queues.some((q) => q.id === queueIds[2])).toBe(true)
      expect(bySubjectType.queues.some((q) => q.id === queueIds[0])).toBe(false)

      const byCollection = await listQueues({
        collection: 'app.bsky.feed.post',
      })
      expect(
        byCollection.queues.every((q) => q.collection === 'app.bsky.feed.post'),
      ).toBe(true)
      expect(byCollection.queues.some((q) => q.id === queueIds[2])).toBe(true)
      expect(byCollection.queues.some((q) => q.id === queueIds[0])).toBe(false)

      const byReportTypes = await listQueues({
        reportTypes: [
          'com.atproto.moderation.defs#reasonSexual',
          'com.atproto.moderation.defs#reasonSpam',
        ],
      })
      // q1 (spam) and q3 (sexual) should appear, q2 (harassment) should not
      expect(byReportTypes.queues.some((q) => q.id === queueIds[0])).toBe(true)
      expect(byReportTypes.queues.some((q) => q.id === queueIds[2])).toBe(true)
      expect(byReportTypes.queues.some((q) => q.id === queueIds[1])).toBe(false)

      // All three combined — only q3 matches
      const combined = await listQueues({
        subjectType: 'record',
        collection: 'app.bsky.feed.post',
        reportTypes: ['com.atproto.moderation.defs#reasonSexual'],
      })
      expect(combined.queues.length).toBe(1)
      expect(combined.queues[0].id).toBe(queueIds[2])
    })

    it('returns queue stats', async () => {
      const result = await listQueues()
      for (const queue of result.queues) {
        expect(queue.stats).toBeDefined()
        expect(typeof queue.stats.pendingCount).toBe('number')
        expect(typeof queue.stats.actionedCount).toBe('number')
        expect(typeof queue.stats.escalatedPendingCount).toBe('number')
        expect(queue.stats.lastUpdated).toBeDefined()
      }
    })
  })

  describe('updateQueue', () => {
    let testQueueId: number

    beforeEach(async () => {
      const { data } = await createQueue({
        name: 'UQ: Test Queue',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonOther'],
      })
      testQueueId = data.queue.id
    })

    afterEach(async () => {
      await deleteQueue(testQueueId).catch(() => {})
    })

    it('updates queue name', async () => {
      const { data } = await updateQueue({
        queueId: testQueueId,
        name: 'UQ: Updated Name',
      })
      expect(data.queue.name).toBe('UQ: Updated Name')
      expect(data.queue.id).toBe(testQueueId)
    })

    it('updates queue enabled status', async () => {
      const { data } = await updateQueue({
        queueId: testQueueId,
        enabled: false,
      })
      expect(data.queue.enabled).toBe(false)

      const { data: reEnabled } = await updateQueue({
        queueId: testQueueId,
        enabled: true,
      })
      expect(reEnabled.queue.enabled).toBe(true)
    })

    it('updates both name and enabled status', async () => {
      const { data } = await updateQueue({
        queueId: testQueueId,
        name: 'UQ: New Name',
        enabled: false,
      })
      expect(data.queue.name).toBe('UQ: New Name')
      expect(data.queue.enabled).toBe(false)
    })

    it('rejects update by non-moderator', async () => {
      await expect(
        updateQueue({ queueId: testQueueId, name: 'Should Fail' }, 'triage'),
      ).rejects.toThrow()
    })

    it('returns error for non-existent queue', async () => {
      await expect(
        updateQueue({ queueId: 999999, name: 'Ghost Queue' }),
      ).rejects.toThrow()
    })
  })

  describe('deleteQueue', () => {
    it('deletes a queue', async () => {
      const { data: created } = await createQueue({
        name: 'DQ: Queue To Delete',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
      })

      const { data } = await deleteQueue(created.queue.id)
      expect(data.deleted).toBe(true)

      // Verify it's gone from list
      const listResult = await listQueues()
      expect(listResult.queues.some((q) => q.id === created.queue.id)).toBe(
        false,
      )
    })

    it('returns error for non-existent queue', async () => {
      await expect(deleteQueue(999999)).rejects.toThrow()
    })

    it('rejects deletion by non-moderator', async () => {
      const { data: created } = await createQueue({
        name: 'DQ: Auth Test Queue',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonMisleading'],
      })

      await expect(
        deleteQueue(created.queue.id, { role: 'triage' }),
      ).rejects.toThrow()

      // Clean up
      await deleteQueue(created.queue.id)
    })

    it('accepts a valid migrateToQueueId', async () => {
      const { data: qA } = await createQueue({
        name: 'DQ: Migrate Source',
        subjectTypes: ['record'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
        collection: 'app.bsky.feed.post',
      })
      const { data: qB } = await createQueue({
        name: 'DQ: Migrate Target',
        subjectTypes: ['record'],
        reportTypes: ['com.atproto.moderation.defs#reasonSexual'],
        collection: 'app.bsky.feed.post',
      })

      const { data } = await deleteQueue(qA.queue.id, {
        migrateToQueueId: qB.queue.id,
      })
      expect(data.deleted).toBe(true)
      expect(data.reportsMigrated).toBe(0)

      // Clean up
      await deleteQueue(qB.queue.id)
    })

    it('rejects migrateToQueueId when target does not exist', async () => {
      const { data: created } = await createQueue({
        name: 'DQ: Bad Migration Source',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonSexual'],
      })

      await expect(
        deleteQueue(created.queue.id, { migrateToQueueId: 999999 }),
      ).rejects.toThrow()

      // Clean up
      await deleteQueue(created.queue.id)
    })
  })
})
