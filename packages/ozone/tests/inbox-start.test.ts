import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'
import { com, tools } from '../src/lexicons/index.js'
import { reportForEvent } from './_inbox.js'

describe('inbox history cutoff', () => {
  let network: TestNetwork
  let sc: SeedClient
  let oldReportId: number
  let visibleReportId: number
  let oldActionId: number
  let oldRecordUri: string
  const startAt = toDatetimeString(Date.now() - 60_000)
  const beforeStart = toDatetimeString(new Date(startAt).getTime() - 1)

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_start',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    const mod = network.ozone.getModClient()
    const subject = com.atproto.admin.defs.repoRef.$build({
      did: sc.dids.alice,
    })
    const oldReport = await sc.createReport({
      reasonType: com.atproto.moderation.defs.ReasonSpam,
      subject,
      reportedBy: sc.dids.bob,
    })
    const visibleReport = await sc.createReport({
      reasonType: com.atproto.moderation.defs.ReasonSpam,
      subject,
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    oldReportId = (await reportForEvent(mod, oldReport.id)).id
    visibleReportId = (await reportForEvent(mod, visibleReport.id)).id
    const oldAction = await mod.emitEvent({
      subject,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
    })
    oldActionId = oldAction.id
    const visibleAction = await mod.emitEvent({
      subject,
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
    })
    const record = sc.posts[sc.dids.alice][0].ref
    oldRecordUri = record.uriStr
    const oldRecordAction = await mod.emitEvent({
      subject: com.atproto.repo.strongRef.$build({
        uri: record.uriStr,
        cid: record.cidStr,
      }),
      event: tools.ozone.moderation.defs.modEventLabel.$build({
        createLabelVals: ['spam'],
        negateLabelVals: [],
      }),
    })
    const db = network.ozone.ctx.db.db
    await db
      .updateTable('report')
      .set({ createdAt: beforeStart })
      .where('id', '=', oldReportId)
      .execute()
    await db
      .updateTable('report')
      .set({ createdAt: startAt, updatedAt: startAt })
      .where('id', '=', visibleReportId)
      .execute()
    await db
      .updateTable('moderation_event')
      .set({ createdAt: beforeStart })
      .where('id', 'in', [oldAction.id, oldRecordAction.id])
      .execute()
    await db
      .updateTable('moderation_event')
      .set({ createdAt: startAt })
      .where('id', '=', visibleAction.id)
      .execute()
    network.ozone.ctx.cfg.inbox.startAt = startAt
  })
  afterAll(async () => network?.close())
  afterEach(() => {
    if (network) network.ozone.ctx.cfg.inbox.startAt = startAt
  })

  function query(did: DidString, method: string, params: object = {}) {
    return sc.agent.call(method, params, undefined, {
      headers: inboxHeaders(network, sc, did),
    })
  }

  function inboxHeaders(network: TestNetwork, sc: SeedClient, did: DidString) {
    return {
      ...sc.getHeaders(did),
      'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
    }
  }

  it.each(['createdAt', 'updatedAt'])(
    'includes the boundary and hides older reports sorted by %s',
    async (sortField) => {
      for (const sortDirection of ['asc', 'desc']) {
        const { data } = await query(
          sc.dids.bob,
          tools.ozone.inbox.listReports.$lxm,
          {
            sortField,
            sortDirection,
            filter: 'unread',
            limit: 1,
          },
        )
        expect(data.reports.map((r: { id: number }) => r.id)).toEqual([
          visibleReportId,
        ])
        expect(data.reports[0].isRead).toBe(false)
        expect(data.cursor).toBeUndefined()
      }
      await expect(
        query(sc.dids.bob, tools.ozone.inbox.getReport.$lxm, {
          id: oldReportId,
        }),
      ).rejects.toMatchObject({ error: 'NotFound' })
      const { data } = await query(
        sc.dids.bob,
        tools.ozone.inbox.getReport.$lxm,
        { id: visibleReportId },
      )
      expect(data.report.id).toBe(visibleReportId)
    },
  )

  it('hides old subjects, action history and report summaries on direct detail reads', async () => {
    const { data } = await query(
      sc.dids.alice,
      tools.ozone.inbox.listActionedSubjects.$lxm,
    )
    expect(data.subjects).toHaveLength(1)
    expect(data.subjects[0].subject.did).toBe(sc.dids.alice)
    expect(data.subjects[0].actionCount).toBe(1)
    const detail = await query(
      sc.dids.alice,
      tools.ozone.inbox.getActionedSubject.$lxm,
      { subject: sc.dids.alice },
    )
    expect(detail.data.actions).toHaveLength(1)
    expect(detail.data.actions[0].createdAt).toBe(startAt)
    expect(detail.data.reports.firstReportedOn).toBe(
      toDatetimeString(`${startAt.slice(0, 10)}T00:00:00.000Z`),
    )
    await expect(
      query(sc.dids.alice, tools.ozone.inbox.getActionedSubject.$lxm, {
        subject: oldRecordUri,
      }),
    ).rejects.toMatchObject({ error: 'NotFound' })
    await expect(
      sc.agent.call(
        tools.ozone.inbox.appealActionedSubject.$lxm,
        {},
        {
          subject: com.atproto.admin.defs.repoRef.$build({
            did: sc.dids.alice,
          }),
          action: tools.ozone.inbox.appealActionedSubject.actionRef.$build({
            id: oldActionId,
          }),
        },
        { headers: inboxHeaders(network, sc, sc.dids.alice) },
      ),
    ).rejects.toMatchObject({ error: 'NotAppealable' })
  })

  it('returns empty history before a future launch and prevents appeals', async () => {
    network.ozone.ctx.cfg.inbox.startAt = toDatetimeString(Date.now() + 60_000)
    const reports = await query(sc.dids.bob, tools.ozone.inbox.listReports.$lxm)
    expect(reports.data.reports).toEqual([])
    expect(reports.data.cursor).toBeUndefined()
    const subjects = await query(
      sc.dids.alice,
      tools.ozone.inbox.listActionedSubjects.$lxm,
    )
    expect(subjects.data.subjects).toEqual([])
    await expect(
      query(sc.dids.bob, tools.ozone.inbox.getReport.$lxm, {
        id: visibleReportId,
      }),
    ).rejects.toMatchObject({ error: 'NotFound' })
    await expect(
      query(sc.dids.alice, tools.ozone.inbox.getActionedSubject.$lxm, {
        subject: sc.dids.alice,
      }),
    ).rejects.toMatchObject({ error: 'NotFound' })
    await expect(
      sc.agent.call(
        tools.ozone.inbox.appealActionedSubject.$lxm,
        {},
        {
          subject: com.atproto.admin.defs.repoRef.$build({
            did: sc.dids.alice,
          }),
        },
        { headers: inboxHeaders(network, sc, sc.dids.alice) },
      ),
    ).rejects.toMatchObject({ error: 'NotAppealable' })
    // Current account standing remains available independently of history.
    expect(
      (await query(sc.dids.alice, tools.ozone.inbox.getAccountStatus.$lxm)).data
        .standing,
    ).toBeDefined()
  })

  it('rejects corrupt source ownership before applying the page limit', async () => {
    const mod = network.ozone.getModClient()
    const other = await sc.createReport({
      reasonType: com.atproto.moderation.defs.ReasonSpam,
      subject: com.atproto.admin.defs.repoRef.$build({ did: sc.dids.alice }),
      reportedBy: sc.dids.carol,
    })
    await network.processAll()
    const otherId = (await reportForEvent(mod, other.id)).id
    await network.ozone.ctx.db.db
      .updateTable('report')
      .set({ reporterDid: sc.dids.bob })
      .where('id', '=', otherId)
      .execute()
    const { data } = await query(
      sc.dids.bob,
      tools.ozone.inbox.listReports.$lxm,
      { limit: 1 },
    )
    expect(data.reports.map((r: { id: number }) => r.id)).toEqual([
      visibleReportId,
    ])
    expect(data.cursor).toBeUndefined()
  })
})
