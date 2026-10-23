import { jest } from '@jest/globals'
import pg from 'pg'
import {
  type AtpAgent,
  type ToolsOzoneQueueCreateQueue,
  ids,
} from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { toDatetimeString } from '@atproto/lex'
import { jsonb } from '../src/db/types.js'
import { com, tools } from '../src/lexicons/index.js'
import { findMatchingQueue } from '../src/queue/service.js'

const spam = 'com.atproto.moderation.defs#reasonSpam'
const reporterTag = 'priority-reporter'
const accountTag = 'priority-account'
const tagQueryPrefix = 'select "did", "tags" from "moderation_subject_status"'

describe('tag-based queue routing', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient
  let ordinaryQueueId: number
  let queueSequence = 0
  const createdQueues: number[] = []
  const taggedSubjects: Parameters<
    ModeratorClient['emitEvent']
  >[0]['subject'][] = []

  const headers = (nsid: string) => network.ozone.modHeaders(nsid, 'admin')

  async function createQueue(
    input: Partial<ToolsOzoneQueueCreateQueue.InputSchema>,
  ) {
    const { data } = await agent.tools.ozone.queue.createQueue(
      {
        name: `Tag Routing ${++queueSequence}`,
        subjectTypes: ['account', 'record'],
        reportTypes: [spam],
        ...input,
      },
      { headers: await headers(ids.ToolsOzoneQueueCreateQueue) },
    )
    createdQueues.push(data.queue.id)
    return data.queue
  }

  async function tag(
    subject: Parameters<ModeratorClient['emitEvent']>[0]['subject'],
    tags: string[],
    durationInHours?: number,
  ) {
    await modClient.emitEvent({
      subject,
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTag',
        add: tags,
        remove: [],
        durationInHours,
      },
    })
    taggedSubjects.push(subject)
  }

  async function tagAccount(
    did: string,
    tags: string[],
    durationInHours?: number,
  ) {
    await tag(
      { $type: 'com.atproto.admin.defs#repoRef', did },
      tags,
      durationInHours,
    )
  }

  async function ordinaryQueue() {
    if (ordinaryQueueId === -1) {
      ordinaryQueueId = (await createQueue({ reportTypes: [spam] })).id
    }
    return ordinaryQueueId
  }

  async function disableOrdinaryQueue() {
    await agent.tools.ozone.queue.updateQueue(
      { queueId: ordinaryQueueId, enabled: false },
      { headers: await headers(tools.ozone.queue.updateQueue.$lxm) },
    )
  }

  async function report(subjectType: 'account' | 'record' = 'account') {
    await ordinaryQueue()
    const subject =
      subjectType === 'account'
        ? { $type: 'com.atproto.admin.defs#repoRef' as const, did: sc.dids.bob }
        : {
            $type: 'com.atproto.repo.strongRef' as const,
            uri: sc.posts[sc.dids.bob][0].ref.uriStr,
            cid: sc.posts[sc.dids.bob][0].ref.cidStr,
          }
    return sc.createReport({
      subject,
      reasonType: spam,
      reportedBy: sc.dids.alice,
    })
  }

  async function getReport(eventId: number, status = 'queued') {
    const { reports } = await modClient.queryReports({ status, limit: 100 })
    const found = reports.find((entry) => entry.eventId === eventId)
    expect(found).toBeDefined()
    return found!
  }

  async function routeExisting(id: number) {
    const { data } = await agent.tools.ozone.queue.routeReports(
      { startReportId: id, endReportId: id },
      { headers: await headers(ids.ToolsOzoneQueueRouteReports) },
    )
    return data
  }

  async function activities(reportId: number) {
    const { data } = await agent.tools.ozone.report.listActivities(
      { reportId },
      { headers: await headers(tools.ozone.report.listActivities.$lxm) },
    )
    return data.activities
  }

  function failRoutingNoteInsert() {
    const originalQuery = pg.Client.prototype.query
    return jest
      .spyOn(pg.Client.prototype, 'query')
      .mockImplementation(function (this: pg.Client, ...args) {
        if (
          typeof args[0] === 'string' &&
          args[0].startsWith('insert into "report_activity"')
        ) {
          return Promise.reject(new Error('routing note write failed'))
        }
        return Reflect.apply(originalQuery, this, args)
      })
  }

  async function unassign(reportId: number, comment?: string) {
    await agent.tools.ozone.report.reassignQueue(
      { reportId, queueId: -1, comment },
      { headers: await headers(tools.ozone.report.reassignQueue.$lxm) },
    )
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_queue_tag_routing',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  beforeEach(() => {
    ordinaryQueueId = -1
  })

  afterEach(async () => {
    for (const subject of taggedSubjects.splice(0)) {
      await modClient.emitEvent({
        subject,
        event: {
          $type: 'tools.ozone.moderation.defs#modEventTag',
          add: [],
          remove: [reporterTag, accountTag],
        },
      })
    }
    for (const queueId of createdQueues.splice(0)) {
      await agent.tools.ozone.queue
        .deleteQueue(
          { queueId },
          { headers: await headers(ids.ToolsOzoneQueueDeleteQueue) },
        )
        .catch(() => {})
    }
  })

  afterAll(async () => network?.close())

  it.each(['account', 'record'] as const)(
    'routes %s reports using the reporter account tags',
    async (subjectType) => {
      const queue = await createQueue({ reporterTags: [reporterTag] })
      await tagAccount(sc.dids.alice, [reporterTag])
      const event = await report(subjectType)
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      const routed = await getReport(event.id)
      expect(routed.queue?.id).toBe(queue.id)
      expect(routed.reportedBy).toBe(sc.dids.alice)
      expect(routed.priorityScore).toBeUndefined()
      const history = await activities(routed.id)
      expect(history).toHaveLength(1)
      expect(history[0]).toMatchObject({
        activity: { $type: tools.ozone.report.defs.noteActivity.$type },
        internalNote: `Automatically routed to queue "${queue.name}" (ID ${queue.id}). Matched reporterTags: ["${reporterTag}"].`,
        isAutomated: true,
        createdBy: network.ozone.ctx.cfg.service.did,
      })
      expect(history[0].publicNote).toBeUndefined()
    },
  )

  it.each(['account', 'record'] as const)(
    'routes %s reports using the reported account tags',
    async (subjectType) => {
      const queue = await createQueue({ accountTags: [accountTag] })
      await tagAccount(sc.dids.bob, [accountTag])
      const event = await report(subjectType)
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      const routed = await getReport(event.id)
      expect(routed.queue?.id).toBe(queue.id)
      const history = await activities(routed.id)
      expect(history).toHaveLength(1)
      expect(history[0].internalNote).toBe(
        `Automatically routed to queue "${queue.name}" (ID ${queue.id}). Matched accountTags: ["${accountTag}"].`,
      )
    },
  )

  it.each([false, true])(
    'uses queue ID rather than tag role (reporter queue created first: %s)',
    async (reporterFirst) => {
      const first = await createQueue(
        reporterFirst
          ? { reporterTags: [reporterTag] }
          : { accountTags: [accountTag] },
      )
      await createQueue(
        reporterFirst
          ? { accountTags: [accountTag] }
          : { reporterTags: [reporterTag] },
      )
      await tagAccount(sc.dids.alice, [reporterTag])
      await tagAccount(sc.dids.bob, [accountTag])
      const event = await report()
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      expect((await getReport(event.id)).queue?.id).toBe(first.id)
    },
  )

  describe.each(['reporterTags', 'accountTags'] as const)(
    '%s precedence',
    (tagField) => {
      it.each([false, true])(
        'prioritizes tag matches over ordinary queues (ordinary first: %s)',
        async (ordinaryFirst) => {
          if (ordinaryFirst) await ordinaryQueue()
          const tag = tagField === 'reporterTags' ? reporterTag : accountTag
          const did = tagField === 'reporterTags' ? sc.dids.alice : sc.dids.bob
          const tagged = await createQueue({ [tagField]: [tag] })
          await tagAccount(did, [tag])
          for (const subjectType of ['account', 'record'] as const) {
            const event = await report(subjectType)
            await network.ozone.daemon.ctx.queueRouter.routeReports()
            const routed = await getReport(event.id)
            expect(routed.queue?.id).toBe(tagged.id)
            expect(await activities(routed.id)).toHaveLength(1)

            await unassign(routed.id)
            expect(await routeExisting(routed.id)).toEqual({
              assigned: 1,
              unmatched: 0,
            })
            expect((await getReport(event.id)).queue?.id).toBe(tagged.id)
          }
        },
      )
    },
  )

  it.each([false, true])(
    'preserves an explicit tool destination ahead of matching tags (invalid: %s)',
    async (invalid) => {
      const explicit = await createQueue({
        subjectTypes: [],
        accountTags: [accountTag],
      })
      await createQueue({ accountTags: [accountTag] })
      await tagAccount(sc.dids.bob, [accountTag])
      const event = await modClient.emitEvent({
        subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.bob },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: spam,
        },
        modTool: {
          name: 'test-tool',
          meta: { queueId: invalid ? -999 : explicit.id, isAutomated: true },
        },
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      const routed = await getReport(event.id, invalid ? 'open' : 'queued')
      expect(routed.queue?.id).toBe(invalid ? undefined : explicit.id)
      expect(routed.isAutomated).toBe(true)
      expect(await activities(routed.id)).toEqual([])
    },
  )

  it('requires both populated tag lists and accepts any tag in each list', async () => {
    const queue = await createQueue({
      reporterTags: ['unmatched-reporter-tag', reporterTag],
      accountTags: ['unmatched-account-tag', accountTag],
    })
    await tagAccount(sc.dids.alice, [reporterTag])
    const first = await report()
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    expect((await getReport(first.id)).queue?.id).toBe(ordinaryQueueId)
    await tagAccount(sc.dids.bob, [accountTag])
    const second = await report()
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    const routed = await getReport(second.id)
    expect(routed.queue?.id).toBe(queue.id)
    const history = await activities(routed.id)
    expect(history).toHaveLength(1)
    expect(history[0].internalNote).toBe(
      `Automatically routed to queue "${queue.name}" (ID ${queue.id}). Matched reporterTags: ["${reporterTag}"]; accountTags: ["${accountTag}"].`,
    )
  })

  it('ignores tags on records and conversations when matching account tags', async () => {
    await createQueue({
      accountTags: [accountTag],
      reporterTags: [reporterTag],
    })
    await tag(
      {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.bob][0].ref.uriStr,
        cid: sc.posts[sc.dids.bob][0].ref.cidStr,
      },
      [accountTag],
    )
    await tag(
      {
        $type: 'chat.bsky.convo.defs#convoRef',
        did: sc.dids.alice,
        convoId: 'tag-routing-convo',
      },
      [reporterTag],
    )
    const event = await report('record')
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    expect((await getReport(event.id)).queue?.id).toBe(ordinaryQueueId)
  })

  it.each([
    { subjectTypes: [] },
    { subjectTypes: ['conversation'] },
    { collection: 'app.bsky.actor.profile' },
  ])('keeps tag-queue filters effective: %j', async (criteria) => {
    await createQueue({ accountTags: [accountTag], ...criteria })
    await tagAccount(sc.dids.bob, [accountTag])
    const event = await report('record')
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    expect((await getReport(event.id)).queue?.id).toBe(ordinaryQueueId)
  })

  it('routes explicitly selected reasons through an untagged queue', async () => {
    const reportTypes = [
      spam,
      'custom-report-reason',
      'tools.ozone.report.defs#reasonAppeal',
    ]
    const queue = await createQueue({ reportTypes })
    for (const reportType of reportTypes) {
      const event = await modClient.emitEvent({
        subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.bob },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType,
        },
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      const routed = await getReport(event.id)
      expect(routed.queue?.id).toBe(queue.id)
      expect(routed.queue?.reportTypes).toEqual(reportTypes)
      expect(await activities(routed.id)).toEqual([])
      await unassign(routed.id)
      expect(await routeExisting(routed.id)).toEqual({
        assigned: 1,
        unmatched: 0,
      })
      expect((await getReport(event.id)).queue?.id).toBe(queue.id)
    }
  })

  it.each([undefined, []])(
    'leaves reports open with no selected report types: %j',
    async (reportTypes) => {
      await createQueue({ reportTypes })
      const event = await modClient.emitEvent({
        subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.bob },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventReport',
          reportType: spam,
        },
      })
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      const routed = await getReport(event.id, 'open')
      expect(routed.queue).toBeUndefined()
      expect(await routeExisting(routed.id)).toEqual({
        assigned: 0,
        unmatched: 1,
      })
    },
  )

  it.each([
    { reporterTags: [reporterTag], reportTypes: undefined },
    { accountTags: [accountTag], reportTypes: undefined },
    { reporterTags: [reporterTag], reportTypes: [] },
    { accountTags: [accountTag], reportTypes: [] },
    { reporterTags: [reporterTag], reportTypes: [spam] },
    { accountTags: [accountTag], reportTypes: [spam] },
    {
      reporterTags: [reporterTag],
      reportTypes: [
        spam,
        'custom-report-reason',
        'tools.ozone.report.defs#reasonAppeal',
      ],
    },
    {
      accountTags: [accountTag],
      reportTypes: [
        spam,
        'custom-report-reason',
        'tools.ozone.report.defs#reasonAppeal',
      ],
    },
  ])(
    'combines tag filters with omitted, empty, or explicit reportTypes: %j',
    async (criteria) => {
      const queue = await createQueue(criteria)
      await ordinaryQueue()
      const reporterDid = network.ozone.moderatorAccnt.did
      await tagAccount(reporterDid, [reporterTag])
      await tagAccount(sc.dids.bob, [accountTag])
      for (const reportType of [
        spam,
        'custom-report-reason',
        'tools.ozone.report.defs#reasonAppeal',
      ]) {
        const expectedQueueId = criteria.reportTypes?.includes(reportType)
          ? queue.id
          : reportType === spam
            ? ordinaryQueueId
            : undefined
        const event = await modClient.emitEvent({
          subject: {
            $type: 'com.atproto.admin.defs#repoRef',
            did: sc.dids.bob,
          },
          event: {
            $type: 'tools.ozone.moderation.defs#modEventReport',
            reportType,
          },
        })
        await network.ozone.daemon.ctx.queueRouter.routeReports()
        const status = expectedQueueId === undefined ? 'open' : 'queued'
        const routed = await getReport(event.id, status)
        expect(routed.reportedBy).toBe(reporterDid)
        expect(routed.queue?.id).toBe(expectedQueueId)
        if (routed.queue) await unassign(routed.id)
        expect(await routeExisting(routed.id)).toEqual({
          assigned: expectedQueueId === undefined ? 0 : 1,
          unmatched: expectedQueueId === undefined ? 1 : 0,
        })
        expect((await getReport(event.id, status)).queue?.id).toBe(
          expectedQueueId,
        )
      }
    },
  )

  it.each([
    { reportTypes: [] },
    { reportTypes: ['*'] },
    { reportTypes: ['*', 'custom-reason'] },
    { reportTypes: ['com.atproto.moderation.defs#reasonOther'] },
  ])(
    'requires a listed reason when there are no tag criteria: %j',
    async ({ reportTypes }) => {
      await createQueue({ reportTypes })
      await tagAccount(sc.dids.alice, [reporterTag])
      await tagAccount(sc.dids.bob, [accountTag])
      const event = await report()
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      expect((await getReport(event.id)).queue?.id).toBe(ordinaryQueueId)
    },
  )

  it('skips disabled and deleted tag destinations', async () => {
    const disabled = await createQueue({ accountTags: [accountTag] })
    const deleted = await createQueue({
      reporterTags: [reporterTag],
    })
    await tagAccount(sc.dids.alice, [reporterTag])
    await tagAccount(sc.dids.bob, [accountTag])
    await agent.tools.ozone.queue.updateQueue(
      { queueId: disabled.id, enabled: false },
      { headers: await headers(ids.ToolsOzoneQueueUpdateQueue) },
    )
    await agent.tools.ozone.queue.deleteQueue(
      { queueId: deleted.id },
      { headers: await headers(ids.ToolsOzoneQueueDeleteQueue) },
    )
    const event = await report()
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    expect((await getReport(event.id)).queue?.id).toBe(ordinaryQueueId)
  })

  it.each([
    { reporterTags: null, accountTags: null },
    { reporterTags: [reporterTag], accountTags: null },
    { reporterTags: null, accountTags: [accountTag] },
  ])(
    'treats nullable queue tag criteria as empty lists: %j',
    async (criteria) => {
      const hasTags = !!(criteria.reporterTags || criteria.accountTags)
      const queueId = hasTags
        ? (
            await createQueue({
              reporterTags: criteria.reporterTags ?? [],
              accountTags: criteria.accountTags ?? [],
            })
          ).id
        : await ordinaryQueue()
      await network.ozone.ctx.db.db
        .updateTable('report_queue')
        .set({
          reporterTags:
            criteria.reporterTags === null
              ? null
              : jsonb(criteria.reporterTags),
          accountTags:
            criteria.accountTags === null ? null : jsonb(criteria.accountTags),
        })
        .where('id', '=', queueId)
        .execute()
      await tagAccount(sc.dids.alice, [reporterTag])
      await tagAccount(sc.dids.bob, [accountTag])
      const event = await report()
      await network.ozone.daemon.ctx.queueRouter.routeReports()
      const routed = await getReport(event.id)
      expect(routed.queue).toMatchObject({
        id: queueId,
        reporterTags: criteria.reporterTags ?? [],
        accountTags: criteria.accountTags ?? [],
      })
      await unassign(routed.id)
      expect(await routeExisting(routed.id)).toEqual({
        assigned: 1,
        unmatched: 0,
      })
      expect((await getReport(event.id)).queue?.id).toBe(queueId)
    },
  )

  it('treats missing account statuses as having no tags', async () => {
    await createQueue({
      reporterTags: [reporterTag],
      accountTags: [accountTag],
    })
    await network.ozone.ctx.db.db
      .deleteFrom('moderation_subject_status')
      .where('did', 'in', [sc.dids.alice, sc.dids.bob])
      .where('recordPath', '=', '')
      .where('convoId', '=', '')
      .execute()
    const event = await report()
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    expect((await getReport(event.id)).queue?.id).toBe(ordinaryQueueId)
  })

  it('routes legacy unassigned reports using the source reporter when reporterDid is null', async () => {
    const event = await report()
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    const original = await getReport(event.id)
    await network.ozone.ctx.db.db
      .updateTable('report')
      .set({
        queueId: -1,
        queuedAt: null,
        status: 'escalated',
        reporterDid: null,
      })
      .where('id', '=', original.id)
      .execute()
    await disableOrdinaryQueue()
    const queue = await createQueue({ reporterTags: [reporterTag] })
    await tagAccount(sc.dids.alice, [reporterTag])
    expect(await routeExisting(original.id)).toEqual({
      assigned: 1,
      unmatched: 0,
    })
    const routed = await getReport(event.id, 'escalated')
    expect(routed.queue?.id).toBe(queue.id)
    expect(routed.status).toBe('escalated')
    const history = await activities(routed.id)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      activity: { $type: tools.ozone.report.defs.noteActivity.$type },
      internalNote: `Automatically routed to queue "${queue.name}" (ID ${queue.id}). Matched reporterTags: ["${reporterTag}"].`,
    })
  })

  it('keeps existing assignments when tags change or ingestion is replayed', async () => {
    const event = await report()
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    const original = await getReport(event.id)
    await createQueue({ reporterTags: [reporterTag] })
    await tagAccount(sc.dids.alice, [reporterTag])
    expect(await routeExisting(original.id)).toEqual({
      assigned: 0,
      unmatched: 0,
    })
    await network.ozone.ctx.db.transaction(async (txn) => {
      await network.ozone.ctx
        .queueService(txn)
        .insertReportsFromEvents({ cursor: event.id - 1, limit: 1 })
    })
    expect((await getReport(event.id)).queue?.id).toBe(ordinaryQueueId)
    expect(await activities(original.id)).toHaveLength(0)
  })

  it('preserves the routing note after tag removal, queue rename, replay, and legacy-owner repair', async () => {
    const queue = await createQueue({ reporterTags: [reporterTag] })
    await tagAccount(sc.dids.alice, [reporterTag])
    const event = await report()
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    const original = await getReport(event.id)
    const history = await activities(original.id)
    expect(history).toHaveLength(1)
    expect(history[0].internalNote).toContain(`"${queue.name}"`)
    expect(history[0].internalNote).toContain(reporterTag)
    await network.ozone.ctx.db.transaction((txn) =>
      network.ozone.ctx
        .queueService(txn)
        .insertReportsFromEvents({ cursor: event.id - 1, limit: 1 }),
    )
    expect(await activities(original.id)).toEqual(history)
    await modClient.emitEvent({
      subject: com.atproto.admin.defs.repoRef.$build({ did: sc.dids.alice }),
      event: tools.ozone.moderation.defs.modEventTag.$build({
        add: [],
        remove: [reporterTag],
      }),
    })
    await agent.tools.ozone.queue.updateQueue(
      { queueId: queue.id, name: `${queue.name} renamed` },
      { headers: await headers(tools.ozone.queue.updateQueue.$lxm) },
    )
    await tagAccount(sc.dids.bob, [accountTag])
    await createQueue({ accountTags: [accountTag] })
    await network.ozone.ctx.db.db
      .updateTable('report')
      .set({ reporterDid: null })
      .where('id', '=', original.id)
      .execute()
    await network.ozone.ctx.db.transaction((txn) =>
      network.ozone.ctx
        .queueService(txn)
        .insertReportsFromEvents({ cursor: event.id - 1, limit: 1 }),
    )
    expect(await routeExisting(original.id)).toEqual({
      assigned: 0,
      unmatched: 0,
    })
    expect((await getReport(event.id)).queue?.id).toBe(queue.id)
    expect((await getReport(event.id)).reportedBy).toBe(sc.dids.alice)
    expect(await activities(original.id)).toEqual(history)
  })

  it('preserves assignment after the expiry worker removes a matching tag', async () => {
    await createQueue({ accountTags: [accountTag] })
    await tagAccount(sc.dids.bob, [accountTag], 1)
    const event = await report()
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    const routed = await getReport(event.id)
    const history = await activities(routed.id)
    expect(history).toHaveLength(1)
    expect(history[0].internalNote).toContain(accountTag)
    // @NOTE Move the expiry deadline without sleeping; removal still uses the real worker.
    await network.ozone.ctx.db.db
      .updateTable('expiring_tag')
      .set({ expiresAt: toDatetimeString(Date.now() - 1000) })
      .where('did', '=', sc.dids.bob)
      .where('tag', '=', accountTag)
      .execute()
    await network.ozone.daemon.ctx.eventReverser.findAndRevertDueActions()
    const { subjectStatuses } = await modClient.queryStatuses({
      subject: sc.dids.bob,
    })
    expect(subjectStatuses[0].tags).not.toContain(accountTag)
    expect(await activities(routed.id)).toEqual(history)
    expect((await getReport(event.id)).queue?.id).toBe(routed.queue?.id)
  })

  it('preserves manual queue activities when routing an unassigned report', async () => {
    const event = await report()
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    const original = await getReport(event.id)
    await unassign(original.id, 'Existing review context.')
    const history = await activities(original.id)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      activity: {
        $type: tools.ozone.report.defs.queueActivity.$type,
        previousStatus: 'queued',
      },
      isAutomated: false,
      meta: { fromQueueId: ordinaryQueueId, toQueueId: -1 },
    })
    expect(history[0].internalNote).toBe('Existing review context.')
    expect(history[0].publicNote).toBeUndefined()
    await disableOrdinaryQueue()
    const queue = await createQueue({ reporterTags: [reporterTag] })
    await tagAccount(sc.dids.alice, [reporterTag])
    const results = await Promise.all([
      routeExisting(original.id),
      routeExisting(original.id),
    ])
    expect(results.map((result) => result.assigned).sort()).toEqual([0, 1])
    expect((await getReport(event.id)).queue?.id).toBe(queue.id)
    const updated = await activities(original.id)
    expect(updated).toHaveLength(2)
    expect(updated[1]).toEqual(history[0])
    expect(updated[0]).toMatchObject({
      activity: { $type: tools.ozone.report.defs.noteActivity.$type },
      internalNote: `Automatically routed to queue "${queue.name}" (ID ${queue.id}). Matched reporterTags: ["${reporterTag}"].`,
      isAutomated: true,
    })
    await routeExisting(original.id)
    expect(await activities(original.id)).toEqual(updated)
  })

  it('records one note when concurrent ingestion routes the same event', async () => {
    await createQueue({ reporterTags: [reporterTag] })
    await tagAccount(sc.dids.alice, [reporterTag])
    const event = await report()
    const insertReport = () =>
      network.ozone.ctx.db.transaction((txn) =>
        network.ozone.ctx
          .queueService(txn)
          .insertReportsFromEvents({ cursor: event.id - 1, limit: 1 }),
      )
    await Promise.all([insertReport(), insertReport()])
    expect(await activities((await getReport(event.id)).id)).toHaveLength(1)
  })

  it('rolls back report insertion and the cursor when the routing note cannot be written', async () => {
    const queue = await createQueue({ reporterTags: [reporterTag] })
    await tagAccount(sc.dids.alice, [reporterTag])
    const event = await report()
    const router = network.ozone.daemon.ctx.queueRouter
    const cursor = await router.getCursor()
    {
      using queries = failRoutingNoteInsert()
      await expect(router.routeReports()).rejects.toThrow(
        'routing note write failed',
      )
      expect(queries).toHaveBeenCalled()
    }
    expect(await router.getCursor()).toBe(cursor)
    const { reports } = await modClient.queryReports({
      status: 'queued',
      limit: 100,
    })
    expect(reports.some((entry) => entry.eventId === event.id)).toBe(false)
    await router.routeReports()
    const routed = await getReport(event.id)
    expect(routed.queue?.id).toBe(queue.id)
    expect(await activities(routed.id)).toHaveLength(1)
  })

  it('rolls back rerouting when its internal note cannot be written', async () => {
    const event = await report()
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    const original = await getReport(event.id)
    await unassign(original.id)
    const history = await activities(original.id)
    await disableOrdinaryQueue()
    const queue = await createQueue({ accountTags: [accountTag] })
    await tagAccount(sc.dids.bob, [accountTag])
    {
      using queries = failRoutingNoteInsert()
      await expect(routeExisting(original.id)).rejects.toThrow()
      expect(queries).toHaveBeenCalled()
    }
    expect((await getReport(event.id, 'open')).queue).toBeUndefined()
    expect(await activities(original.id)).toEqual(history)
    await routeExisting(original.id)
    expect((await getReport(event.id)).queue?.id).toBe(queue.id)
    expect(await activities(original.id)).toHaveLength(history.length + 1)
  })

  it('uses queue ID across tag roles ahead of an older ordinary queue regardless of input order', async () => {
    const ordinaryId = await ordinaryQueue()
    const first = await createQueue({ reporterTags: [reporterTag] })
    const second = await createQueue({ accountTags: [accountTag] })
    const service = network.ozone.ctx.queueService(network.ozone.ctx.db)
    const ordinaryRow = (await service.getById(ordinaryId))!
    const firstRow = (await service.getById(first.id))!
    const secondRow = (await service.getById(second.id))!
    for (const queues of [
      [ordinaryRow, secondRow, firstRow],
      [secondRow, firstRow, ordinaryRow],
      [firstRow, ordinaryRow, secondRow],
    ]) {
      expect(
        findMatchingQueue(
          queues,
          'account',
          null,
          spam,
          [reporterTag],
          [accountTag],
        )?.id,
      ).toBe(first.id)
    }
  })

  it('fetches deduplicated account tags once for a report batch', async () => {
    await createQueue({ reporterTags: [reporterTag] })
    await tagAccount(sc.dids.alice, [reporterTag])
    for (let count = 0; count < 5; count++) await report()
    using queries = jest.spyOn(pg.Client.prototype, 'query')
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    const lookups = queries.mock.calls.filter(
      ([text]) => typeof text === 'string' && text.startsWith(tagQueryPrefix),
    )
    expect(lookups).toHaveLength(1)
    expect(
      queries.mock.calls.filter(
        ([text]) =>
          typeof text === 'string' &&
          text.startsWith('insert into "report_activity"'),
      ),
    ).toHaveLength(1)
    expect(lookups[0][1]).toEqual(
      expect.arrayContaining([sc.dids.alice, sc.dids.bob]),
    )
    expect(
      (lookups[0][1] as unknown as string[]).filter(
        (value) => value === sc.dids.alice,
      ),
    ).toHaveLength(1)
  })

  it('skips the tag lookup when enabled automatic queues do not use tags', async () => {
    await report()
    using queries = jest.spyOn(pg.Client.prototype, 'query')
    await network.ozone.daemon.ctx.queueRouter.routeReports()
    expect(
      queries.mock.calls.filter(
        ([text]) => typeof text === 'string' && text.startsWith(tagQueryPrefix),
      ),
    ).toHaveLength(0)
  })

  it('rolls back the cursor and report insertion when the tag lookup fails', async () => {
    await createQueue({ reporterTags: [reporterTag] })
    await tagAccount(sc.dids.alice, [reporterTag])
    const event = await report()
    const router = network.ozone.daemon.ctx.queueRouter
    const cursor = await router.getCursor()
    const originalQuery = pg.Client.prototype.query
    {
      using queries = jest
        .spyOn(pg.Client.prototype, 'query')
        .mockImplementation(function (this: pg.Client, ...args) {
          if (
            typeof args[0] === 'string' &&
            args[0].startsWith(tagQueryPrefix)
          ) {
            return Promise.reject(new Error('tag lookup failed'))
          }
          return Reflect.apply(originalQuery, this, args)
        })
      await expect(router.routeReports()).rejects.toThrow('tag lookup failed')
      expect(queries).toHaveBeenCalled()
    }
    expect(await router.getCursor()).toBe(cursor)
    const { reports } = await modClient.queryReports({
      status: 'queued',
      limit: 100,
    })
    expect(reports.some((entry) => entry.eventId === event.id)).toBe(false)
    await router.routeReports()
    expect((await getReport(event.id)).queue?.reporterTags).toEqual([
      reporterTag,
    ])
  })
})
