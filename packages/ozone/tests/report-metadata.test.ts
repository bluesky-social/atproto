import { type AtpAgent, ids } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { chat, com, tools } from '../src/lexicons/index.js'
import { inboxHeaders, reportForEvent } from './_inbox.js'

describe('report activity metadata', () => {
  let network: TestNetwork
  let sc: SeedClient
  let mod: ModeratorClient
  let agent: AtpAgent
  let fixtureNumber = 0

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_metadata',
    })
    sc = network.getSeedClient()
    mod = network.ozone.getModClient()
    agent = network.ozone.getAgent()
    await basicSeed(sc)
    await network.processAll()
  })
  afterAll(async () => network?.close())

  async function fixture() {
    const name = `metadata${++fixtureNumber}`
    const { did } = await sc.createAccount(name, {
      handle: `${name}.test`,
      email: `${name}@example.com`,
      password: 'password',
    })
    const subject = com.atproto.admin.defs.repoRef.$build({ did })
    const event = await sc.createReport({
      subject,
      reportedBy: sc.dids.bob,
      reasonType: com.atproto.moderation.defs.ReasonSpam,
    })
    await network.processAll()
    return { did, subject, report: await reportForEvent(mod, event.id) }
  }

  const metadata = {
    source: 'example-worker',
    runId: 'example-run',
    decisionId: 'example-decision',
    rules: [{ name: 'example/review-rule', version: 2 }],
    resolution: 'linked',
    actionEventId: 999,
    appealOutcome: 'granted',
    createdBy: 'did:example:other',
  }
  const expectedMetadata = {
    source: 'example-worker',
    runId: 'example-run',
    decisionId: 'example-decision',
    rules: [{ name: 'example/review-rule', version: 2 }],
  }

  async function create(
    input: Parameters<
      AtpAgent['tools']['ozone']['report']['createActivity']
    >[0],
  ) {
    return (
      await agent.tools.ozone.report.createActivity(input, {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportCreateActivity,
        ),
      })
    ).data.activity
  }

  async function close(
    input: Parameters<AtpAgent['tools']['ozone']['report']['closeReports']>[0],
  ) {
    return (
      await agent.tools.ozone.report.closeReports(input, {
        encoding: 'application/json',
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneReportCloseReports,
        ),
      })
    ).data
  }

  async function activities(reportId: number) {
    return (
      await agent.tools.ozone.report.listActivities(
        { reportId },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneReportListActivities,
          ),
        },
      )
    ).data.activities
  }

  async function detail(id: number) {
    return (
      await agent.tools.ozone.report.getReport(
        { id },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneReportGetReport,
          ),
        },
      )
    ).data
  }

  async function takedown(
    subject: ReturnType<typeof com.atproto.admin.defs.repoRef.$build>,
  ) {
    return mod.emitEvent({
      subject,
      event: tools.ozone.moderation.defs.modEventTakedown.$build({}),
    })
  }

  it.each(['reportId', 'eventId'] as const)(
    'records direct closure metadata through %s',
    async (key) => {
      const { report } = await fixture()
      const activity = await create({
        [key]: key === 'reportId' ? report.id : report.eventId,
        activity: tools.ozone.report.defs.closeActivity.$build({}),
        meta: metadata,
        isAutomated: true,
      })
      expect(activity.meta).toEqual({
        ...expectedMetadata,
        resolution: 'noAction',
      })
      expect(activity.isAutomated).toBe(true)
      expect(activity.createdBy).not.toBe('did:example:other')
      expect(
        (await activities(report.id)).find((row) => row.id === activity.id)
          ?.meta,
      ).toEqual(activity.meta)
      expect((await detail(report.id)).actionEventIds ?? []).toEqual([])
    },
  )

  it('leaves non-closing activity outcomes server-owned and automation explicit', async () => {
    const { report } = await fixture()
    const activity = await create({
      reportId: report.id,
      activity: tools.ozone.report.defs.noteActivity.$build({}),
      meta: metadata,
    })
    expect(activity.meta).toEqual(expectedMetadata)
    expect(activity.isAutomated).toBe(false)
    expect((await detail(report.id)).status).toBe('open')
  })

  it('round trips custom metadata without a source on both report endpoints', async () => {
    const { did, report } = await fixture()
    const meta = { custom: { batch: 'example-batch', flags: [true, false] } }
    const note = await create({
      reportId: report.id,
      activity: tools.ozone.report.defs.noteActivity.$build({}),
      meta,
    })
    expect(note.meta).toEqual(meta)
    await close({ subject: did, meta })
    const rows = await activities(report.id)
    expect(rows.find((row) => row.id === note.id)?.meta).toEqual(meta)
    expect(
      rows.find(
        (row) =>
          row.activity.$type === tools.ozone.report.defs.closeActivity.$type,
      )?.meta,
    ).toEqual({ ...meta, resolution: 'noAction' })
  })

  it.each(['direct', 'event'] as const)(
    'preserves trusted metadata values in the %s path',
    async (path) => {
      const { did, subject, report } = await fixture()
      const meta = {
        source: '',
        rules: [
          { name: 'custom-rule', version: 'draft', extra: true },
          { name: 'custom-rule', version: 'draft', extra: true },
        ],
        runId: 12,
        relatedTakedownEventId: 2_000_000_000,
        custom: { payload: 'a'.repeat(20_000) },
      }
      let actionEventId: number | undefined
      if (path === 'direct') {
        const note = await create({
          reportId: report.id,
          activity: tools.ozone.report.defs.noteActivity.$build({}),
          meta,
        })
        expect(note.meta).toEqual(meta)
        await close({ subject: did, meta })
      } else {
        const event = await mod.emitEvent({
          subject,
          event: tools.ozone.moderation.defs.modEventTakedown.$build({}),
          reportAction: { ids: [report.id] },
          modTool: { name: 'example-processor', meta },
        })
        actionEventId = event.id
      }
      const closure = (await activities(report.id)).find(
        (row) =>
          row.activity.$type === tools.ozone.report.defs.closeActivity.$type,
      )
      expect(closure?.meta).toEqual({
        ...meta,
        resolution: path === 'direct' ? 'noAction' : 'linked',
        ...(actionEventId === undefined ? {} : { actionEventId }),
      })
      expect((await detail(report.id)).actionEventIds ?? []).toEqual(
        actionEventId === undefined ? [] : [actionEventId],
      )
    },
  )

  it('records actual event links and explicit automation on event-generated activities', async () => {
    const { subject, report } = await fixture()
    const event = await mod.emitEvent({
      subject,
      event: tools.ozone.moderation.defs.modEventTakedown.$build({}),
      reportAction: { ids: [report.id], isAutomated: true },
      modTool: { name: 'example-processor', meta: metadata },
    })
    const closure = (await activities(report.id)).find(
      (row) =>
        row.activity.$type === tools.ozone.report.defs.closeActivity.$type,
    )
    expect(closure?.meta).toEqual({
      ...expectedMetadata,
      resolution: 'linked',
      actionEventId: event.id,
    })
    expect(closure?.isAutomated).toBe(true)
    expect((await detail(report.id)).actionEventIds).toEqual([event.id])
  })

  it('does not infer automation from an event tool name', async () => {
    const { subject, report } = await fixture()
    await mod.emitEvent({
      subject,
      event: tools.ozone.moderation.defs.modEventTakedown.$build({}),
      reportAction: { ids: [report.id] },
      modTool: { name: 'example-processor', meta: metadata },
    })
    expect(
      (await activities(report.id)).find(
        (row) =>
          row.activity.$type === tools.ozone.report.defs.closeActivity.$type,
      )?.isAutomated,
    ).toBe(false)
  })

  it('keeps a related takedown as context across owned cleanup and no-op retries', async () => {
    const { did, subject, report } = await fixture()
    const post = await sc.post(did, 'Example record')
    const subjects = [
      com.atproto.repo.strongRef.$build({
        uri: post.ref.uriStr,
        cid: post.ref.cidStr,
      }),
      chat.bsky.convo.defs.messageRef.$build({
        did,
        convoId: 'example-conversation',
        messageId: 'example-message',
      }),
      chat.bsky.convo.defs.convoRef.$build({
        did,
        convoId: 'example-conversation',
      }),
    ]
    const reports = [report]
    for (const owned of subjects) {
      const event = await sc.createReport({
        subject: owned,
        reportedBy: sc.dids.bob,
        reasonType: com.atproto.moderation.defs.ReasonSpam,
      })
      await network.processAll()
      reports.push(await reportForEvent(mod, event.id))
    }
    const event = await takedown(subject)
    const input = {
      subject: did,
      includeAllOwned: true,
      isAutomated: true,
      meta: { ...metadata, relatedTakedownEventId: event.id },
    }
    expect((await close(input)).closedCount).toBe(4)
    for (const row of reports) {
      const closures = (await activities(row.id)).filter(
        (a) => a.activity.$type === tools.ozone.report.defs.closeActivity.$type,
      )
      expect(closures).toHaveLength(1)
      expect(closures[0].meta).toEqual({
        ...expectedMetadata,
        resolution: 'noAction',
        relatedTakedownEventId: event.id,
      })
      expect(closures[0].isAutomated).toBe(true)
      expect((await detail(row.id)).actionEventIds ?? []).toEqual([])
    }
    expect((await close(input)).closedCount).toBe(0)
    expect(
      (await activities(report.id)).filter(
        (a) => a.activity.$type === tools.ozone.report.defs.closeActivity.$type,
      ),
    ).toHaveLength(1)
  })

  it('preserves earlier action history when a reopened report closes without action', async () => {
    const { did, subject, report } = await fixture()
    const event = await mod.emitEvent({
      subject,
      event: tools.ozone.moderation.defs.modEventTakedown.$build({}),
      reportAction: { ids: [report.id], isAutomated: true },
      modTool: { name: 'example-processor', meta: metadata },
    })
    await create({
      reportId: report.id,
      activity: tools.ozone.report.defs.reopenActivity.$build({}),
    })
    await close({
      subject: did,
      meta: { ...metadata, relatedTakedownEventId: event.id },
      isAutomated: true,
    })
    expect((await detail(report.id)).actionEventIds).toEqual([event.id])
    const latest = (await activities(report.id)).find(
      (row) =>
        row.activity.$type === tools.ozone.report.defs.closeActivity.$type,
    )
    expect(latest?.meta).toEqual({
      ...expectedMetadata,
      relatedTakedownEventId: event.id,
      resolution: 'noAction',
    })
  })

  it('retains default activity metadata and legacy rule attribution', async () => {
    const { did, report } = await fixture()
    const note = await create({
      reportId: report.id,
      activity: tools.ozone.report.defs.noteActivity.$build({}),
    })
    expect(note.meta).toBeUndefined()
    await close({
      subject: did,
      meta: { source: 'example', rules: 'legacy-rule' },
    })
    expect(
      (await activities(report.id)).find(
        (row) =>
          row.activity.$type === tools.ozone.report.defs.closeActivity.$type,
      )?.meta,
    ).toEqual({
      source: 'example',
      rules: 'legacy-rule',
      resolution: 'noAction',
    })
  })

  it('keeps internal metadata out of reporter detail and notifications', async () => {
    const { did, report } = await fixture()
    await close({
      subject: did,
      meta: { ...metadata, custom: { trace: 'example-private-trace' } },
      isAutomated: true,
    })
    await network.processAll()
    const headers = inboxHeaders(network, sc, sc.dids.bob)
    const detail = await sc.agent.call(
      tools.ozone.inbox.getReport.$lxm,
      { id: report.id },
      undefined,
      { headers },
    )
    const notifications = await sc.agent.call(
      tools.ozone.inbox.listNotifications.$lxm,
      {},
      undefined,
      { headers },
    )
    for (const data of [detail.data, notifications.data]) {
      const serialized = JSON.stringify(data)
      expect(serialized).not.toContain('example/review-rule')
      expect(serialized).not.toContain('example-run')
      expect(serialized).not.toContain('example-worker')
      expect(serialized).not.toContain('example-private-trace')
    }
  })
})
