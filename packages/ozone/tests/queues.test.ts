import { ids } from '@atproto/api'
import type AtpAgent from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { currentDatetimeString } from '@atproto/lex'
import { jsonb } from '../src/db/types.js'

describe('ozone-queues', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  const modHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'admin')

  const triageHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'triage')

  const createQueue = async (
    input: {
      name: string
      subjectTypes?: string[]
      reportTypes?: string[]
      reporterTags?: string[]
      accountTags?: string[]
      collection?: string
      description?: string
      recommendedPolicies?: string[]
      recommendedLabels?: string[]
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
    input: {
      queueId: number
      name?: string
      enabled?: boolean
      description?: string
      recommendedPolicies?: string[]
      recommendedLabels?: string[]
    },
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
      dbPostgresSchema: 'ozone_queue_tag_criteria',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
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
      expect(data.queue.recommendedPolicies).toEqual([])
      expect(data.queue.recommendedLabels).toEqual([])
      expect(data.queue.reporterTags).toEqual([])
      expect(data.queue.accountTags).toEqual([])
    })

    it('rejects null report types', async () => {
      await expect(
        agent.call(
          ids.ToolsOzoneQueueCreateQueue,
          undefined,
          { name: 'CQ: Invalid Null Reasons', reportTypes: null },
          {
            encoding: 'application/json',
            headers: await modHeaders(ids.ToolsOzoneQueueCreateQueue),
          },
        ),
      ).rejects.toMatchObject({ error: 'InvalidRequest' })
    })

    it('stores recommended labels and rejects labels mapped to another queue', async () => {
      const { data } = await createQueue({
        name: 'CQ: Label Mapping',
        subjectTypes: [],
        reportTypes: [],
        recommendedLabels: ['spam-label', 'scam-label'],
      })
      createdIds.push(data.queue.id)
      expect(data.queue.recommendedLabels).toEqual(['spam-label', 'scam-label'])

      await expect(
        createQueue({
          name: 'CQ: Conflicting Label Mapping',
          subjectTypes: [],
          reportTypes: [],
          recommendedLabels: ['spam-label'],
        }),
      ).rejects.toMatchObject({ error: 'ConflictingQueue' })
    })

    it('stores valid recommended policies and rejects unknown policies', async () => {
      const { data } = await createQueue({
        name: 'CQ: Recommended Policies',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonOther'],
        recommendedPolicies: ['policy-one'],
      })
      createdIds.push(data.queue.id)
      expect(data.queue.recommendedPolicies).toEqual(['policy-one'])

      await expect(
        createQueue({
          name: 'CQ: Unknown Policy',
          subjectTypes: ['account'],
          reportTypes: ['com.atproto.moderation.defs#reasonOther'],
          recommendedPolicies: ['Not A Policy'],
        }),
      ).rejects.toMatchObject({ error: 'InvalidRecommendedPolicies' })
    })

    it('creates a queue with description', async () => {
      const { data } = await createQueue({
        name: 'CQ: Described Queue',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
        description: 'Handles spam account reports',
      })
      createdIds.push(data.queue.id)

      expect(data.queue.description).toBe('Handles spam account reports')
    })

    it('creates a queue with conversation subject type', async () => {
      const { data } = await createQueue({
        name: 'CQ: Spam Convos',
        subjectTypes: ['conversation'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
      })
      createdIds.push(data.queue.id)

      expect(data.queue.subjectTypes).toEqual(['conversation'])
    })

    it('rejects conflicting queue - overlapping conversation queues', async () => {
      const { data: q1 } = await createQueue({
        name: 'CQ: Threat Convos',
        subjectTypes: ['conversation'],
        reportTypes: ['tools.ozone.report.defs#reasonViolenceThreats'],
      })
      createdIds.push(q1.queue.id)

      await expect(
        createQueue({
          name: 'CQ: Threat Convos Duplicate',
          subjectTypes: ['conversation'],
          reportTypes: ['tools.ozone.report.defs#reasonViolenceThreats'],
        }),
      ).rejects.toMatchObject({ error: 'ConflictingQueue' })
    })

    it('allows conversation queue alongside account queue with same report type', async () => {
      const { data: q1 } = await createQueue({
        name: 'CQ: Misleading Accounts',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonMisleading'],
      })
      createdIds.push(q1.queue.id)

      const { data: q2 } = await createQueue({
        name: 'CQ: Misleading Convos',
        subjectTypes: ['conversation'],
        reportTypes: ['com.atproto.moderation.defs#reasonMisleading'],
      })
      createdIds.push(q2.queue.id)

      expect(q2.queue.subjectTypes).toEqual(['conversation'])
    })

    it('rejects invalid subject types', async () => {
      await expect(
        createQueue({
          name: 'CQ: Invalid Subject Type',
          subjectTypes: ['convo'],
          reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
        }),
      ).rejects.toMatchObject({ error: 'InvalidSubjectType' })
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
        name: 'CQ: Threat Accounts',
        subjectTypes: ['account'],
        reportTypes: ['tools.ozone.report.defs#reasonViolenceThreats'],
      })
      createdIds.push(q1.queue.id)

      await expect(
        createQueue({
          name: 'CQ: Threat Accounts Duplicate',
          subjectTypes: ['account'],
          reportTypes: ['tools.ozone.report.defs#reasonViolenceThreats'],
        }),
      ).rejects.toMatchObject({ error: 'ConflictingQueue' })
    })

    it('rejects creating a queue with a duplicate name', async () => {
      const { data: q1 } = await createQueue({
        name: 'CQ: Duplicate Name',
        subjectTypes: ['account'],
        reportTypes: ['com.atproto.moderation.defs#reasonSpam'],
      })
      createdIds.push(q1.queue.id)

      // Distinct criteria (different report type) so only the name collides —
      // proves the name check fires, not attribute-overlap.
      await expect(
        createQueue({
          name: 'CQ: Duplicate Name',
          subjectTypes: ['account'],
          reportTypes: ['tools.ozone.report.defs#reasonViolenceThreats'],
        }),
      ).rejects.toMatchObject({
        error: 'ConflictingQueue',
        message: 'A queue with that name already exists',
      })
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
          'tools.ozone.report.defs#reasonViolenceThreats',
          'com.atproto.moderation.defs#reasonMisleading',
        ],
      })
      createdIds.push(q1.queue.id)

      // threat overlaps = conflict
      await expect(
        createQueue({
          name: 'CQ: Just Threat',
          subjectTypes: ['account'],
          reportTypes: ['tools.ozone.report.defs#reasonViolenceThreats'],
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

  describe('routing criteria configuration', () => {
    const createdIds: number[] = []
    const reason = 'com.atproto.moderation.defs#reasonSpam'

    afterEach(async () => {
      await cleanupQueues(createdIds.splice(0))
    })

    const create = async (input: Parameters<typeof createQueue>[0]) => {
      const { data } = await createQueue(input)
      createdIds.push(data.queue.id)
      return data.queue
    }

    it('stores criteria and preserves them through legacy updates and views', async () => {
      const criteria = {
        subjectTypes: ['account', 'record'],
        reportTypes: [reason],
        reporterTags: ['priority-reporter', 'trusted-reporter'],
        accountTags: ['priority-account'],
      }
      const queue = await create({ name: 'RC: Tagged', ...criteria })
      expect(queue).toMatchObject(criteria)
      expect(queue.collection).toBeUndefined()

      // @NOTE Unknown update fields must not make creation-time criteria mutable.
      const attemptedCriteria = {
        reportTypes: [],
        reporterTags: [],
        accountTags: [],
      }
      const { data } = await updateQueue({
        queueId: queue.id,
        name: 'RC: Renamed',
        enabled: false,
        description: 'Updated description',
        recommendedPolicies: ['policy-one'],
        recommendedLabels: ['routing-label'],
        ...attemptedCriteria,
      })
      expect(data.queue).toMatchObject({ ...criteria, enabled: false })
      const { queues } = await listQueues()
      expect(queues.find((q) => q.id === queue.id)).toMatchObject(criteria)
    })

    it('defaults omitted fields for manual queues', async () => {
      const queue = await create({ name: 'RC: Manual Defaults' })
      expect(queue).toMatchObject({
        subjectTypes: [],
        reporterTags: [],
        accountTags: [],
      })
      expect(queue.reportTypes).toEqual([])
    })

    it.each([undefined, []])(
      'preserves empty report types through updates, listings, and assignments: %j',
      async (reportTypes) => {
        const queue = await create({
          name: 'RC: No Automatic Reasons',
          subjectTypes: ['account'],
          reportTypes,
        })
        expect(queue.reportTypes).toEqual([])
        const { data: updated } = await updateQueue({
          queueId: queue.id,
          name: 'RC: No Automatic Reasons Renamed',
        })
        expect(updated.queue.reportTypes).toEqual([])
        const { queues } = await listQueues({ reportTypes: [reason] })
        expect(queues.map((q) => q.id)).not.toContain(queue.id)
        const { data: assigned } =
          await agent.tools.ozone.queue.assignModerator(
            { queueId: queue.id, did: network.ozone.moderatorAccnt.did },
            { headers: await modHeaders(ids.ToolsOzoneQueueAssignModerator) },
          )
        expect(assigned.queue.reportTypes).toEqual([])
        const { data: listed } = await agent.tools.ozone.queue.getAssignments(
          { queueIds: [queue.id] },
          { headers: await modHeaders(ids.ToolsOzoneQueueGetAssignments) },
        )
        expect(listed.assignments[0].queue.reportTypes).toEqual([])
      },
    )

    it('accepts explicitly selected reasons beyond 25 entries', async () => {
      const reportTypes = Array.from(
        { length: 60 },
        (_, index) => `reason-${index}`,
      )
      const queue = await create({
        name: 'RC: Selected Reasons',
        subjectTypes: ['account'],
        reportTypes,
      })
      expect(queue.reportTypes).toEqual(reportTypes)
      const { queues } = await listQueues({ reportTypes: [reportTypes[59]] })
      expect(queues.map((q) => q.id)).toContain(queue.id)
    })

    it('retains criteria in moderator assignment views', async () => {
      const criteria = {
        reporterTags: ['priority-reporter'],
        accountTags: ['priority-account'],
        reportTypes: [reason],
      }
      const queue = await create({ name: 'RC: Assigned', ...criteria })
      const { data: assigned } = await agent.tools.ozone.queue.assignModerator(
        { queueId: queue.id, did: network.ozone.moderatorAccnt.did },
        { headers: await modHeaders(ids.ToolsOzoneQueueAssignModerator) },
      )
      expect(assigned.queue).toMatchObject(criteria)
      const { data: listed } = await agent.tools.ozone.queue.getAssignments(
        { queueIds: [queue.id] },
        { headers: await modHeaders(ids.ToolsOzoneQueueGetAssignments) },
      )
      expect(listed.assignments[0].queue).toMatchObject(criteria)
    })

    it('normalizes nullable criteria from legacy queue writers in views and updates', async () => {
      const now = currentDatetimeString()
      const legacy = await network.ozone.ctx.db.db
        .insertInto('report_queue')
        .values({
          name: 'RC: Legacy Writer',
          subjectTypes: jsonb([]),
          collection: null,
          reportTypes: jsonb([]),
          description: null,
          recommendedPolicies: jsonb([]),
          recommendedLabels: jsonb([]),
          createdBy: network.ozone.adminAccnt.did,
          createdAt: now,
          updatedAt: now,
          enabled: true,
          deletedAt: null,
        })
        .returning(['id', 'reporterTags', 'accountTags'])
        .executeTakeFirstOrThrow()
      createdIds.push(legacy.id)
      expect(legacy.reporterTags).toBeNull()
      expect(legacy.accountTags).toBeNull()
      const { data: updated } = await updateQueue({
        queueId: legacy.id,
        name: 'RC: Legacy Writer Renamed',
      })
      expect(updated.queue).toMatchObject({ reporterTags: [], accountTags: [] })
      const { data: assigned } = await agent.tools.ozone.queue.assignModerator(
        { queueId: legacy.id, did: network.ozone.moderatorAccnt.did },
        { headers: await modHeaders(ids.ToolsOzoneQueueAssignModerator) },
      )
      expect(assigned.queue).toMatchObject({
        reporterTags: [],
        accountTags: [],
      })
      const { data: assignments } =
        await agent.tools.ozone.queue.getAssignments(
          { queueIds: [legacy.id] },
          { headers: await modHeaders(ids.ToolsOzoneQueueGetAssignments) },
        )
      expect(assignments.assignments[0].queue).toMatchObject({
        reporterTags: [],
        accountTags: [],
      })
      const { queues } = await listQueues()
      expect(queues.find((q) => q.id === legacy.id)).toMatchObject({
        reporterTags: [],
        accountTags: [],
      })
    })

    it.each([
      { reporterTags: [''] },
      { accountTags: [''] },
      { reporterTags: Array(26).fill('tag') },
      { accountTags: Array(26).fill('tag') },
    ])('rejects invalid criteria %j', async (criteria) => {
      await expect(
        createQueue({ name: 'RC: Invalid', ...criteria }),
      ).rejects.toMatchObject({ error: 'InvalidRequest' })
    })

    it.each([['*'], ['*', reason]])(
      'matches report reason filters literally: %j',
      async (...reportTypes) => {
        const all = await create({
          name: 'RC: Literal Reasons',
          accountTags: ['tagged-account'],
          subjectTypes: ['account'],
          reportTypes,
        })
        const specific = await create({
          name: 'RC: Specific Reason',
          subjectTypes: ['account'],
          reportTypes: [reason],
        })
        const manual = await create({ name: 'RC: No Reasons', reportTypes: [] })

        for (const reportType of [reason, 'custom-report-reason']) {
          const { queues } = await listQueues({ reportTypes: [reportType] })
          const ids = queues.map((q) => q.id)
          expect(ids.includes(all.id)).toBe(reportTypes.includes(reportType))
          expect(ids).not.toContain(manual.id)
          expect(ids.includes(specific.id)).toBe(reportType === reason)
        }
      },
    )

    it('allows overlaps across tag roles and preserves criteria during edits', async () => {
      const ordinary = await create({
        name: 'RC: Ordinary',
        subjectTypes: ['account'],
        reportTypes: [reason],
      })
      const reporting = await create({
        name: 'RC: Reporter',
        subjectTypes: ['account', 'record'],
        reporterTags: ['priority-reporter'],
        reportTypes: [reason],
      })
      const reported = await create({
        name: 'RC: Account',
        subjectTypes: ['account', 'record'],
        accountTags: ['priority-account'],
        reportTypes: [reason],
      })
      for (const queue of [ordinary, reporting, reported]) {
        const { data } = await updateQueue({
          queueId: queue.id,
          name: `${queue.name} Renamed`,
        })
        expect(data.queue).toMatchObject({
          reporterTags: queue.reporterTags,
          accountTags: queue.accountTags,
          reportTypes: queue.reportTypes,
        })
      }
    })

    it('keeps name and recommended-label uniqueness across tag roles', async () => {
      await create({
        name: 'RC: Unique',
        subjectTypes: ['account'],
        reportTypes: [reason],
        recommendedLabels: ['unique-routing-label'],
      })
      await expect(createQueue({ name: 'RC: Unique' })).rejects.toMatchObject({
        error: 'ConflictingQueue',
      })
      await expect(
        createQueue({
          name: 'RC: Duplicate Label',
          recommendedLabels: ['unique-routing-label'],
        }),
      ).rejects.toMatchObject({ error: 'ConflictingQueue' })
    })

    it.each([false, true])(
      'rejects overlapping tag criteria regardless of creation order (unrestricted collection first: %s)',
      async (unrestrictedFirst) => {
        const all = {
          name: 'RC: Unrestricted Collection',
          subjectTypes: ['record'],
          accountTags: ['account-tag'],
          reportTypes: [reason],
        }
        const specific = {
          name: 'RC: Specific With Same Tag Role',
          subjectTypes: ['record'],
          collection: 'app.bsky.feed.post',
          reportTypes: [reason],
          accountTags: ['different-tag'],
        }
        await create(unrestrictedFirst ? all : specific)
        await expect(
          createQueue(unrestrictedFirst ? specific : all),
        ).rejects.toMatchObject({ error: 'ConflictingQueue' })
      },
    )

    it.each([false, true])(
      'allows disjoint reasons with literal wildcard-looking values (literal first: %s)',
      async (literalFirst) => {
        const literal = {
          name: 'RC: Literal Reason',
          subjectTypes: ['record'],
          reportTypes: ['*'],
        }
        const specific = {
          name: 'RC: Ordinary Specific',
          subjectTypes: ['record'],
          reportTypes: [reason],
        }
        await create(literalFirst ? literal : specific)
        await create(literalFirst ? specific : literal)
      },
    )

    it.each(['reporterTags', 'accountTags'] as const)(
      'allows %s queues with empty or disjoint report reasons',
      async (field) => {
        await create({
          name: 'RC: Tagged Reason',
          subjectTypes: ['account'],
          reportTypes: [reason],
          [field]: ['first-tag'],
        })
        for (const reportTypes of [[], ['custom-report-reason']]) {
          await create({
            name: `RC: Tagged Disjoint ${reportTypes.length}`,
            subjectTypes: ['account'],
            reportTypes,
            [field]: ['second-tag'],
          })
        }
      },
    )

    it('allows disjoint collections but detects shared non-record subjects', async () => {
      const criteria = {
        subjectTypes: ['record'],
        reportTypes: [reason],
        accountTags: ['account-tag'],
      }
      await create({
        name: 'RC: Posts',
        collection: 'app.bsky.feed.post',
        ...criteria,
      })
      await create({
        name: 'RC: Profiles',
        collection: 'app.bsky.actor.profile',
        ...criteria,
      })
      await cleanupQueues(createdIds.splice(0))
      await create({
        name: 'RC: Accounts And Posts',
        collection: 'app.bsky.feed.post',
        ...criteria,
        subjectTypes: ['account', 'record'],
      })
      await expect(
        createQueue({
          name: 'RC: Accounts And Profiles',
          collection: 'app.bsky.actor.profile',
          ...criteria,
          subjectTypes: ['account', 'record'],
        }),
      ).rejects.toMatchObject({ error: 'ConflictingQueue' })
    })

    it('allows manual-only and empty-reason queues alongside automatic queues', async () => {
      await create({
        name: 'RC: Automatic',
        subjectTypes: ['account'],
        reportTypes: [reason],
      })
      await create({
        name: 'RC: Manual With Reasons',
        reportTypes: [reason],
      })
      await create({
        name: 'RC: Empty Reasons',
        subjectTypes: ['account'],
        reportTypes: [],
      })
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
        name: 'LQ: Threat',
        subjectTypes: ['account'],
        reportTypes: ['tools.ozone.report.defs#reasonViolenceThreats'],
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
        bySubjectType.queues.every((q) => q.subjectTypes?.includes('record')),
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
      // q1 (spam) and q3 (sexual) should appear, q2 (threat) should not
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
      await modClient.computeStats()
      const result = await listQueues()
      for (const queue of result.queues) {
        expect(queue.stats).toBeDefined()
        expect(typeof queue.stats.pendingCount).toBe('number')
        expect(typeof queue.stats.actionedCount).toBe('number')
        expect(typeof queue.stats.escalatedCount).toBe('number')
        expect(queue.stats.closedCount).toBe(0)
        expect(queue.stats.acknowledgedCount).toBe(0)
        expect(queue.stats.ahtSampleCount).toBe(0)
        expect(queue.stats.resolutionSampleCount).toBe(0)
        expect(queue.stats.avgHandlingTimeSec).toBeUndefined()
        expect(queue.stats.avgResolutionTimeSec).toBeUndefined()
      }
    })

    it('returns stored lifecycle counts and durations in queue stats', async () => {
      await modClient.computeStats()
      const stored = {
        inboundCount: 20,
        pendingCount: 5,
        closedCount: 10,
        actionedCount: 6,
        acknowledgedCount: 4,
        escalatedCount: 2,
        labelActionCount: 1,
        tagActionCount: 2,
        takedownActionCount: 3,
        ahtDurationSec: 1200,
        ahtSampleCount: 4,
        resolutionDurationSec: 36000,
        resolutionSampleCount: 10,
        actionRate: 60,
        avgHandlingTimeSec: 300,
        avgResolutionTimeSec: 3600,
      }
      await network.ozone.ctx.db.db
        .updateTable('report_stat')
        .set(stored)
        .where('queueId', '=', queueIds[0])
        .where('moderatorDid', 'is', null)
        .where('reportTypes', 'is', null)
        .execute()

      const { queues } = await listQueues()
      expect(queues.find((q) => q.id === queueIds[0])?.stats).toEqual({
        ...stored,
        closureTargetMetCount: 0,
        closureTargetMissedCount: 0,
        closureTargetOverdueCount: 0,
        lastUpdated: expect.any(String),
      })
    })

    it('omits unavailable lifecycle fields from legacy queue stats', async () => {
      await modClient.computeStats()
      await network.ozone.ctx.db.db
        .updateTable('report_stat')
        .set({
          closedCount: null,
          acknowledgedCount: null,
          labelActionCount: null,
          tagActionCount: null,
          takedownActionCount: null,
          ahtDurationSec: null,
          ahtSampleCount: null,
          resolutionDurationSec: null,
          resolutionSampleCount: null,
          avgResolutionTimeSec: null,
          avgHandlingTimeSec: 120,
        })
        .where('queueId', '=', queueIds[0])
        .where('moderatorDid', 'is', null)
        .where('reportTypes', 'is', null)
        .execute()

      const { queues } = await listQueues()
      expect(queues.find((q) => q.id === queueIds[0])?.stats).toEqual({
        inboundCount: 0,
        pendingCount: 0,
        actionedCount: 0,
        escalatedCount: 0,
        avgHandlingTimeSec: 120,
        closureTargetMetCount: 0,
        closureTargetMissedCount: 0,
        closureTargetOverdueCount: 0,
        lastUpdated: expect.any(String),
      })
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

    it('updates queue description', async () => {
      const { data } = await updateQueue({
        queueId: testQueueId,
        description: 'Updated description',
      })
      expect(data.queue.description).toBe('Updated description')
    })

    it('updates recommended policies and rejects unknown policies', async () => {
      const { data } = await updateQueue({
        queueId: testQueueId,
        recommendedPolicies: ['policy-two'],
      })
      expect(data.queue.recommendedPolicies).toEqual(['policy-two'])

      await expect(
        updateQueue({
          queueId: testQueueId,
          recommendedPolicies: ['Not A Policy'],
        }),
      ).rejects.toMatchObject({ error: 'InvalidRecommendedPolicies' })
    })

    it('updates recommended labels and rejects a conflicting mapping', async () => {
      const { data: other } = await createQueue({
        name: 'UQ: Other Label Queue',
        subjectTypes: [],
        reportTypes: [],
        recommendedLabels: ['other-label'],
      })
      const { data } = await updateQueue({
        queueId: testQueueId,
        recommendedLabels: ['test-label'],
      })
      expect(data.queue.recommendedLabels).toEqual(['test-label'])

      await expect(
        updateQueue({
          queueId: testQueueId,
          recommendedLabels: ['other-label'],
        }),
      ).rejects.toMatchObject({ error: 'ConflictingQueue' })
      await deleteQueue(other.queue.id)
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

  describe('report migration on delete', () => {
    const REASON_SPAM = 'com.atproto.moderation.defs#reasonSpam'
    const REASON_THREAT = 'tools.ozone.report.defs#reasonViolenceThreats'

    const reportAccount = async (did: string, reportType: string) => {
      await modClient.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType,
          comment: 'test report',
        },
        subject: { $type: 'com.atproto.admin.defs#repoRef', did },
      })
    }

    const queryLatestReportForSubject = async (
      subjectOrUri: string,
      status:
        'open' | 'closed' | 'escalated' | 'queued' | 'assigned' = 'queued',
    ) => {
      const { reports } = await modClient.queryReports({
        status,
        subject: subjectOrUri,
      })
      return reports[0]
    }

    it('migrates non-closed reports to the target queue', async () => {
      const [{ data: qAData }, { data: qBData }] = await Promise.all([
        createQueue({
          name: 'M: Spam Accounts',
          subjectTypes: ['account'],
          reportTypes: [REASON_SPAM],
        }),
        createQueue({
          name: 'M: Threat Accounts',
          subjectTypes: ['account'],
          reportTypes: [REASON_THREAT],
        }),
      ])

      await reportAccount(sc.dids.alice, REASON_SPAM)
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const { data } = await deleteQueue(qAData.queue.id, {
        migrateToQueueId: qBData.queue.id,
      })
      expect(data.deleted).toBe(true)
      expect(data.reportsMigrated).toBe(1)

      const report = await queryLatestReportForSubject(sc.dids.alice)
      expect(report.queue?.id).toBe(qBData.queue.id)
      expect(report.queuedAt).toBeDefined()

      // Clean up
      await deleteQueue(qBData.queue.id)
    })

    it('moves non-closed reports to -1 when no target is specified', async () => {
      const {
        data: { queue },
      } = await createQueue({
        name: 'M: Spam No Target',
        subjectTypes: ['account'],
        reportTypes: [REASON_SPAM],
      })

      await reportAccount(sc.dids.bob, REASON_SPAM)
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const { data } = await deleteQueue(queue.id)
      expect(data.deleted).toBe(true)
      expect(data.reportsMigrated).toBe(1)

      const report = await queryLatestReportForSubject(sc.dids.bob)
      expect(report.queue).toBeUndefined()
      expect(report.queuedAt).toBeUndefined()
    })

    it('does not migrate closed reports', async () => {
      const {
        data: { queue },
      } = await createQueue({
        name: 'M: Spam Closed',
        subjectTypes: ['account'],
        reportTypes: [REASON_SPAM],
      })

      await reportAccount(sc.dids.carol, REASON_SPAM)
      await network.ozone.daemon.ctx.queueRouter.routeReports()

      const reportBefore = await queryLatestReportForSubject(sc.dids.carol)
      expect(reportBefore.queue?.id).toBe(queue.id)

      // Close the report directly — no API surface for setting status in tests
      await network.ozone.daemon.ctx.db.db
        .updateTable('report')
        .set({ status: 'closed' })
        .where('id', '=', reportBefore.id)
        .execute()

      const { data } = await deleteQueue(queue.id)
      expect(data.deleted).toBe(true)
      expect(data.reportsMigrated).toBe(0)

      // Closed report remains assigned to the soft-deleted queue for historical reference
      const reportAfter = await queryLatestReportForSubject(
        sc.dids.carol,
        'closed',
      )
      expect(reportAfter.queue?.id).toBe(queue.id)
    })

    it('allows creating a queue with the same name and config after soft delete', async () => {
      const {
        data: { queue: original },
      } = await createQueue({
        name: 'M: Reusable Config',
        subjectTypes: ['account'],
        reportTypes: [REASON_THREAT],
      })
      await deleteQueue(original.id)

      // Same name and config should be allowed once the original is soft-deleted
      const {
        data: { queue: replacement },
      } = await createQueue({
        name: 'M: Reusable Config',
        subjectTypes: ['account'],
        reportTypes: [REASON_THREAT],
      })
      expect(replacement.id).not.toBe(original.id)

      // Clean up
      await deleteQueue(replacement.id)
    })
  })
})
