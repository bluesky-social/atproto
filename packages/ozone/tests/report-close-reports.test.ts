import { sql } from 'kysely'
import { ComAtprotoModerationDefs, ids } from '@atproto/api'
import type AtpAgent from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { chat, com, tools } from '../src/lexicons/index.js'
import {
  CHAT_CONVO_COLLECTION,
  CHAT_MESSAGE_COLLECTION,
} from '../src/mod-service/subject.js'
import { inboxHeaders, reportForEvent } from './_inbox.js'

const DEFS = 'tools.ozone.report.defs'

describe('report-close-reports', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  const modHeaders = async (nsid: string) =>
    network.ozone.modHeaders(nsid, 'admin')

  const reportSubject = async (
    subject:
      | { $type: 'com.atproto.admin.defs#repoRef'; did: string }
      | { $type: 'com.atproto.repo.strongRef'; uri: string; cid: string },
    reasonType: string = ComAtprotoModerationDefs.REASONSPAM,
  ) => {
    await sc.createReport({
      reasonType,
      subject,
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
  }

  const queryReports = async (params: {
    status: string
    subject?: string
    did?: string
  }) => {
    const { data } = await agent.tools.ozone.report.queryReports(params, {
      headers: await modHeaders(ids.ToolsOzoneReportQueryReports),
    })
    return data.reports
  }

  const closeReports = async (input: {
    subject: string
    includeAllOwned?: boolean
    reportTypes?: string[]
    internalNote?: string
    isAutomated?: boolean
    meta?: Record<string, unknown>
  }) => {
    return agent.tools.ozone.report.closeReports(input, {
      encoding: 'application/json',
      headers: await network.ozone.modHeaders(
        ids.ToolsOzoneReportCloseReports,
        'admin',
      ),
    })
  }

  const listActivities = async (reportId: number) => {
    const { data } = await agent.tools.ozone.report.listActivities(
      { reportId },
      { headers: await modHeaders(ids.ToolsOzoneReportListActivities) },
    )
    return data.activities
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_close_reports',
    })
    agent = network.ozone.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  let fixtureNumber = 0
  async function fixture() {
    const name = `closereports${++fixtureNumber}`
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@example.com`,
      password: 'password',
    })
    const post = await sc.post(did, 'Example post')
    return {
      did,
      account: com.atproto.admin.defs.repoRef.$build({ did }),
      record: com.atproto.repo.strongRef.$build({
        uri: post.ref.uriStr,
        cid: post.ref.cidStr,
      }),
      message: chat.bsky.convo.defs.messageRef.$build({
        did,
        convoId: 'example-conversation',
        messageId: 'example-message',
      }),
      conversation: chat.bsky.convo.defs.convoRef.$build({
        did,
        convoId: 'example-conversation',
      }),
    }
  }

  async function report(
    subject: Parameters<ModeratorClient['emitEvent']>[0]['subject'],
    reasonType: string = com.atproto.moderation.defs.ReasonSpam,
  ) {
    const event = await sc.createReport({
      subject,
      reasonType,
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    return reportForEvent(network.ozone.getModClient(), event.id)
  }

  async function reportsForSubjects(
    subjects: Parameters<ModeratorClient['emitEvent']>[0]['subject'][],
  ) {
    const rows: Awaited<ReturnType<typeof report>>[] = []
    for (const subject of subjects) rows.push(await report(subject))
    return rows
  }

  async function detail(id: number) {
    return (
      await agent.tools.ozone.report.getReport(
        { id },
        { headers: await modHeaders(ids.ToolsOzoneReportGetReport) },
      )
    ).data
  }

  async function reopen(reportId: number) {
    await agent.tools.ozone.report.createActivity(
      {
        reportId,
        activity: tools.ozone.report.defs.reopenActivity.$build({}),
      },
      { headers: await modHeaders(ids.ToolsOzoneReportCreateActivity) },
    )
  }

  async function inbox(reportId: number) {
    return (
      await sc.agent.tools.ozone.inbox.getReport(
        { id: reportId },
        { headers: inboxHeaders(network, sc, sc.dids.bob) },
      )
    ).data
  }

  it.each([undefined, false])(
    'keeps account closure exact when includeAllOwned is %s',
    async (includeAllOwned) => {
      const f = await fixture()
      const selected = await report(f.account)
      const untouched = await reportsForSubjects([
        f.record,
        f.message,
        f.conversation,
      ])
      expect(
        (await closeReports({ subject: f.did, includeAllOwned })).data,
      ).toEqual({ closedCount: 1, reportIds: [selected.id] })
      for (const r of untouched)
        expect((await detail(r.id)).status).toBe('open')
    },
  )

  it.each([undefined, false])(
    'keeps record closure exact when includeAllOwned is %s',
    async (includeAllOwned) => {
      const f = await fixture()
      const selected = await report(f.record)
      const untouched = await reportsForSubjects([
        f.account,
        f.message,
        f.conversation,
      ])
      expect(
        (await closeReports({ subject: f.record.uri, includeAllOwned })).data,
      ).toEqual({ closedCount: 1, reportIds: [selected.id] })
      for (const r of untouched)
        expect((await detail(r.id)).status).toBe('open')
    },
  )

  it('closes every same-DID subject from an account input and isolates shared chat IDs', async () => {
    const f = await fixture()
    const foreign = await fixture()
    const selected = await reportsForSubjects([
      f.account,
      f.record,
      f.message,
      f.conversation,
    ])
    const untouched = await reportsForSubjects([
      foreign.account,
      foreign.record,
      foreign.message,
      foreign.conversation,
    ])
    const input = {
      subject: f.did,
      includeAllOwned: true,
      internalNote: 'Reports reviewed',
      isAutomated: true,
    }
    const { data } = await closeReports(input)
    expect(data.closedCount).toBe(selected.length)
    expect(data.reportIds.sort()).toEqual(selected.map((r) => r.id).sort())
    for (const r of selected) {
      expect((await detail(r.id)).status).toBe('closed')
      expect((await detail(r.id)).actionEventIds ?? []).toEqual([])
      expect(await listActivities(r.id)).toEqual([
        expect.objectContaining({
          internalNote: 'Reports reviewed',
          isAutomated: true,
        }),
      ])
    }
    for (const r of untouched) {
      expect((await detail(r.id)).status).toBe('open')
      expect(await listActivities(r.id)).toHaveLength(0)
    }
    expect((await closeReports(input)).data).toEqual({
      closedCount: 0,
      reportIds: [],
    })
  })

  it.each(['record', 'message', 'conversation'] as const)(
    'rejects includeAllOwned for a %s AT-URI without closing any reports',
    async (kind) => {
      const f = await fixture()
      const selected = await report(f[kind])
      const untouched = await reportsForSubjects(
        [f.account, f.record, f.message, f.conversation].filter(
          (subject) => subject !== f[kind],
        ),
      )
      const subject =
        kind === 'record'
          ? f.record.uri
          : kind === 'message'
            ? `at://${f.did}/${CHAT_MESSAGE_COLLECTION}/${f.message.messageId}`
            : `at://${f.did}/${CHAT_CONVO_COLLECTION}/${f.conversation.convoId}`
      await expect(
        closeReports({ subject, includeAllOwned: true }),
      ).rejects.toMatchObject({
        error: 'InvalidRequest',
        message: 'includeAllOwned is only valid for account subjects',
      })
      for (const r of [selected, ...untouched]) {
        expect((await detail(r.id)).status).toBe('open')
        expect(await listActivities(r.id)).toHaveLength(0)
      }
      expect(
        (await closeReports({ subject, includeAllOwned: false })).data,
      ).toEqual({ closedCount: 1, reportIds: [selected.id] })
      for (const r of untouched)
        expect((await detail(r.id)).status).toBe('open')
    },
  )

  it('retains optional reason filtering across all owned subjects', async () => {
    const f = await fixture()
    const selected = await reportsForSubjects([
      f.account,
      f.record,
      f.message,
      f.conversation,
    ])
    const other = await report(f.record, com.atproto.moderation.defs.ReasonRude)
    const { data } = await closeReports({
      subject: f.did,
      includeAllOwned: true,
      reportTypes: [com.atproto.moderation.defs.ReasonSpam],
    })
    expect(data.closedCount).toBe(selected.length)
    expect(data.reportIds.sort()).toEqual(selected.map((r) => r.id).sort())
    expect((await detail(other.id)).status).toBe('open')
    expect(
      (
        await closeReports({
          subject: f.did,
          includeAllOwned: true,
          reportTypes: [],
        })
      ).data.reportIds,
    ).toEqual([other.id])
  })

  it('associates selected reasons with enforcement and no-actions the remainder', async () => {
    const f = await fixture()
    const actioned = await report(f.account)
    const remaining = [
      await report(f.account, com.atproto.moderation.defs.ReasonRude),
      await report(f.record),
    ]
    const action = await network.ozone.getModClient().emitEvent({
      subject: f.account,
      event: tools.ozone.moderation.defs.modEventTakedown.$build({
        durationInHours: 24,
      }),
      reportAction: { types: [com.atproto.moderation.defs.ReasonSpam] },
    })
    expect(
      (
        await closeReports({ subject: f.did, includeAllOwned: true })
      ).data.reportIds.sort(),
    ).toEqual(remaining.map((r) => r.id).sort())
    expect((await detail(actioned.id)).actionEventIds).toEqual([action.id])
    expect((await inbox(actioned.id)).resolution?.outcome).toBe('actionTaken')
    for (const r of remaining) {
      expect((await detail(r.id)).actionEventIds ?? []).toEqual([])
      expect((await inbox(r.id)).resolution?.outcome).toBe('noAction')
    }
  })

  it('preserves old action links while counting the current closure as no-action', async () => {
    const f = await fixture()
    const reason = tools.ozone.report.defs.ReasonMisleadingBot
    const r = await report(f.record, reason)
    const mod = network.ozone.getModClient()
    const queue = (
      await agent.tools.ozone.queue.createQueue(
        { name: 'Closure history', subjectTypes: [], reportTypes: [reason] },
        { headers: await modHeaders(ids.ToolsOzoneQueueCreateQueue) },
      )
    ).data.queue
    await agent.tools.ozone.report.reassignQueue(
      { reportId: r.id, queueId: queue.id },
      { headers: await modHeaders(ids.ToolsOzoneReportReassignQueue) },
    )
    const label = await mod.emitEvent({
      subject: f.record,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { ids: [r.id] },
    })
    await reopen(r.id)
    await closeReports({ subject: f.did, includeAllOwned: true })
    expect((await detail(r.id)).actionEventIds).toEqual([label.id])
    expect((await inbox(r.id)).resolution?.outcome).toBe('noAction')
    const stats = async () => {
      await mod.computeStats()
      return (
        await agent.tools.ozone.report.getLiveStats(
          { queueId: queue.id },
          { headers: await modHeaders(ids.ToolsOzoneReportGetLiveStats) },
        )
      ).data.stats
    }
    expect(await stats()).toMatchObject({
      closedCount: 1,
      actionedCount: 0,
      acknowledgedCount: 1,
      labelActionCount: 0,
    })
    await reopen(r.id)
    await mod.emitEvent({
      subject: f.record,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
      reportAction: { ids: [r.id] },
    })
    expect(await stats()).toMatchObject({
      closedCount: 1,
      actionedCount: 1,
      acknowledgedCount: 0,
      labelActionCount: 1,
    })
  })

  it('does not duplicate activities during concurrent cleanup', async () => {
    const f = await fixture()
    const reports = await reportsForSubjects([f.account, f.record])
    const input = { subject: f.did, includeAllOwned: true }
    const results = await Promise.all([
      closeReports(input),
      closeReports(input),
    ])
    expect(
      results.reduce((count, result) => count + result.data.closedCount, 0),
    ).toBe(reports.length)
    for (const r of reports) expect(await listActivities(r.id)).toHaveLength(1)
  })

  it('closes all open reports on an account subject', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      ComAtprotoModerationDefs.REASONRUDE,
    )

    const openBefore = await queryReports({
      status: 'open',
      subject: sc.dids.alice,
    })
    expect(openBefore.length).toBeGreaterThanOrEqual(2)

    const { data } = await closeReports({
      subject: sc.dids.alice,
      internalNote: 'Auto-closed by rules engine.',
      isAutomated: true,
    })

    expect(data.closedCount).toBe(openBefore.length)
    expect(data.reportIds.sort()).toEqual(openBefore.map((r) => r.id).sort())

    const openAfter = await queryReports({
      status: 'open',
      subject: sc.dids.alice,
    })
    expect(openAfter).toHaveLength(0)

    // Each closed report gets a closeActivity with the note + isAutomated
    for (const reportId of data.reportIds) {
      const activities = await listActivities(reportId)
      const close = activities.find(
        (a) => a.activity.$type === `${DEFS}#closeActivity`,
      )
      expect(close).toBeDefined()
      expect(close!.internalNote).toBe('Auto-closed by rules engine.')
      expect(close!.isAutomated).toBe(true)
    }
  })

  it('filters by report types', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      ComAtprotoModerationDefs.REASONMISLEADING,
    )

    const { data } = await closeReports({
      subject: sc.dids.carol,
      reportTypes: [ComAtprotoModerationDefs.REASONSPAM],
    })
    expect(data.closedCount).toBe(1)

    const stillOpen = await queryReports({
      status: 'open',
      subject: sc.dids.carol,
    })
    expect(stillOpen).toHaveLength(1)
    expect(stillOpen[0].reportType).toBe(
      ComAtprotoModerationDefs.REASONMISLEADING,
    )
  })

  it('scopes to record-level reports when subject is an AT-URI', async () => {
    const post = sc.posts[sc.dids.alice][0].ref
    await reportSubject(
      {
        $type: 'com.atproto.repo.strongRef',
        uri: post.uriStr,
        cid: post.cidStr,
      },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    // account-level report on the same DID should not be touched
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      ComAtprotoModerationDefs.REASONSPAM,
    )

    const { data } = await closeReports({ subject: post.uriStr })
    expect(data.closedCount).toBe(1)

    const accountReports = await queryReports({
      status: 'open',
      subject: sc.dids.alice,
    })
    expect(accountReports).toHaveLength(1)
  })

  it('scopes message, conversation, and account reports independently', async () => {
    const convoId = 'close-reports-convo'
    const messageId = 'close-reports-message'
    const convoUri = `at://${sc.dids.dan}/chat.bsky.convo/${convoId}`
    const messageUri = `at://${sc.dids.dan}/chat.bsky.convo.message/${messageId}`

    await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: {
        $type: 'chat.bsky.convo.defs#messageRef',
        did: sc.dids.dan,
        convoId,
        messageId,
      },
      reportedBy: sc.dids.bob,
    })
    await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: {
        $type: 'chat.bsky.convo.defs#convoRef',
        did: sc.dids.dan,
        convoId,
      },
      reportedBy: sc.dids.bob,
    })
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.dan },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    await network.processAll()

    const accountResult = await closeReports({ subject: sc.dids.dan })
    expect(accountResult.data.closedCount).toBe(1)

    const messageResult = await closeReports({ subject: messageUri })
    expect(messageResult.data.closedCount).toBe(1)

    const convoResult = await closeReports({ subject: convoUri })
    expect(convoResult.data.closedCount).toBe(1)
  })

  it('returns zero when no reports match', async () => {
    const { data } = await closeReports({
      subject: 'did:plc:doesnotexistanywhere',
    })
    expect(data.closedCount).toBe(0)
    expect(data.reportIds).toEqual([])
  })

  it('rejects a subject that is neither a DID nor an AT-URI', async () => {
    await expect(
      closeReports({ subject: 'https://example.com' }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
  })

  it('closes queued reports too', async () => {
    await reportSubject(
      { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.dan },
      ComAtprotoModerationDefs.REASONSPAM,
    )
    const [report] = await queryReports({
      status: 'open',
      subject: sc.dids.dan,
    })
    await agent.tools.ozone.report.createActivity(
      {
        reportId: report.id,
        activity: { $type: `${DEFS}#queueActivity` },
      },
      {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportCreateActivity,
          'admin',
        ),
      },
    )

    const { data } = await closeReports({ subject: sc.dids.dan })
    expect(data.closedCount).toBe(1)
    expect(data.reportIds).toEqual([report.id])
  })
  it('closes thousands of reports atomically within SQL parameter limits', async () => {
    const f = await fixture()
    const template = await report(f.record)
    const db = network.ozone.ctx.db
    const meta = {
      source: 'example-worker',
      rules: [{ name: 'example/cleanup', version: 1 }],
      custom: { batch: 'example-batch' },
    }
    // @NOTE Bulk database fixtures exercise the protocol parameter limit directly.
    await sql`
      with events as (
        insert into moderation_event (action, "subjectType", "subjectDid", "subjectUri", "subjectCid", "createdAt", "createdBy", meta)
        select action, "subjectType", "subjectDid", "subjectUri", "subjectCid", "createdAt", "createdBy", meta
        from moderation_event cross join generate_series(1, 7000)
        where id = ${template.eventId}
        returning id
      )
      insert into report ("eventId", did, "reporterDid", "recordPath", "reportType", status, "createdAt", "updatedAt", "queueId", "isMuted", "isAutomated")
      select events.id, r.did, r."reporterDid", r."recordPath", r."reportType", r.status, r."createdAt", r."updatedAt", -1, false, false
      from events cross join report r where r.id = ${template.id}
    `.execute(db.db)
    const lastReport = await db.db
      .selectFrom('report')
      .select('id')
      .where('did', '=', f.did)
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirstOrThrow()
    await sql`create function fail_close_batch() returns trigger language plpgsql as $$ begin raise exception 'Injected close batch failure'; end $$`.execute(
      db.db,
    )
    await sql`create trigger fail_close_batch before insert on report_activity for each row when (new."reportId" = ${sql.lit(lastReport.id)}) execute function fail_close_batch()`.execute(
      db.db,
    )
    try {
      await expect(
        closeReports({ subject: f.did, includeAllOwned: true, meta }),
      ).rejects.toThrow()
      const closed = await db.db
        .selectFrom('report')
        .select(({ fn }) => fn.countAll<number>().as('count'))
        .where('did', '=', f.did)
        .where('status', '=', 'closed')
        .executeTakeFirstOrThrow()
      expect(closed.count).toBe(0)
      expect(await listActivities(template.id)).toHaveLength(0)
    } finally {
      await sql`drop trigger fail_close_batch on report_activity`.execute(db.db)
      await sql`drop function fail_close_batch()`.execute(db.db)
    }
    const { data } = await closeReports({
      subject: f.did,
      includeAllOwned: true,
      meta,
    })
    expect(data.closedCount).toBe(7001)
    expect(new Set(data.reportIds).size).toBe(7001)
    const counts = await db.db
      .selectFrom('report_activity')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .where('reportId', 'in', data.reportIds)
      .executeTakeFirstOrThrow()
    expect(counts.count).toBe(7001)
    expect((await listActivities(template.id))[0].meta).toEqual({
      ...meta,
      resolution: 'noAction',
    })
    expect(
      (await closeReports({ subject: f.did, includeAllOwned: true })).data
        .closedCount,
    ).toBe(0)
  })
})
