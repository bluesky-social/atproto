import { ComAtprotoModerationDefs } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { toDatetimeString } from '@atproto/lex'
import type { DidString } from '@atproto/syntax'

describe('viewer inbox reports', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  let proxyHeader: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_report_reads',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    proxyHeader = `${network.ozone.ctx.cfg.service.did}#atproto_labeler`
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => network?.close())

  function call(did: DidString, method: string, params: object = {}) {
    return sc.agent.call(method, params, undefined, {
      headers: { ...sc.getHeaders(did), 'atproto-proxy': proxyHeader },
    })
  }

  it("lists only the viewer's reports and uses event IDs for detail links", async () => {
    const bobReport = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      reason: 'Repeated scam links',
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      reportedBy: sc.dids.bob,
    })
    const carolReport = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.alice },
      reportedBy: sc.dids.carol,
    })
    await network.processAll()

    const { data: page } = await call(
      sc.dids.bob,
      'tools.ozone.inbox.listReports',
    )
    expect(page.reports.map((r: { id: number }) => r.id)).toContain(
      bobReport.id,
    )
    expect(page.reports.map((r: { id: number }) => r.id)).not.toContain(
      carolReport.id,
    )
    const { data: detail } = await call(
      sc.dids.bob,
      'tools.ozone.inbox.getReport',
      {
        id: bobReport.id,
      },
    )
    expect(detail.report).toMatchObject({
      id: bobReport.id,
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      reason: 'Repeated scam links',
      status: 'pending',
    })
    expect(detail.resolution).toBeUndefined()
    await expect(
      call(sc.dids.bob, 'tools.ozone.inbox.getReport', {
        id: carolReport.id,
      }),
    ).rejects.toMatchObject({ error: 'NotFound' })
    const preview = await fetch(
      `${network.ozone.url}/xrpc/tools.ozone.inbox.getReport?did=${encodeURIComponent(sc.dids.bob)}&id=${bobReport.id}`,
      {
        headers: await network.ozone.modHeaders('tools.ozone.inbox.getReport'),
      },
    )
    expect(preview.status).toBe(200)
    expect((await preview.json()).report.id).toBe(bobReport.id)
    const forbidden = await sc.agent.fetchHandler(
      `/xrpc/tools.ozone.inbox.getReport?did=${encodeURIComponent(sc.dids.bob)}&id=${bobReport.id}`,
      {
        headers: {
          ...sc.getHeaders(sc.dids.carol),
          'atproto-proxy': proxyHeader,
        },
      },
    )
    expect(forbidden.status).toBe(403)
  })

  it('pages by a stable cursor and derives unread state from the section watermark', async () => {
    const first = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      reportedBy: sc.dids.bob,
    })
    const second = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      reportedBy: sc.dids.bob,
    })
    await network.processAll()

    const { data: page1 } = await call(
      sc.dids.bob,
      'tools.ozone.inbox.listReports',
      {
        limit: 1,
        sortField: 'createdAt',
      },
    )
    const { data: page2 } = await call(
      sc.dids.bob,
      'tools.ozone.inbox.listReports',
      {
        limit: 1,
        sortField: 'createdAt',
        cursor: page1.cursor,
      },
    )
    expect(page1.reports).toHaveLength(1)
    expect(page2.reports).toHaveLength(1)
    expect(page1.reports[0].id).not.toBe(page2.reports[0].id)
    expect([first.id, second.id]).toContain(page1.reports[0].id)

    await network.ozone.ctx.db.db
      .insertInto('inbox_seen')
      .values({
        did: sc.dids.bob,
        section: 'reports',
        seenAt: toDatetimeString(Date.now() + 1000),
      })
      .execute()
    const { data: read } = await call(
      sc.dids.bob,
      'tools.ozone.inbox.listReports',
      {
        filter: 'unread',
      },
    )
    expect(read.reports).toHaveLength(0)
    const { data: all } = await call(
      sc.dids.bob,
      'tools.ozone.inbox.listReports',
    )
    expect(all.reports.every((r: { isRead: boolean }) => r.isRead)).toBe(true)
  })

  it('rejects malformed report cursors', async () => {
    await expect(
      call(sc.dids.bob, 'tools.ozone.inbox.listReports', { cursor: 'bogus' }),
    ).rejects.toMatchObject({ error: 'InvalidRequest' })
  })

  it('shows only the action linked to a resolved report', async () => {
    const report = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      reportedBy: sc.dids.bob,
    })
    await network.processAll()
    const row = await network.ozone.ctx.db.db
      .selectFrom('report')
      .where('eventId', '=', report.id)
      .select('id')
      .executeTakeFirstOrThrow()
    await modClient.emitEvent({
      event: {
        $type: 'tools.ozone.moderation.defs#modEventTakedown',
        comment: 'MODERATOR-ONLY-COMMENT',
      },
      subject: { $type: 'com.atproto.admin.defs#repoRef', did: sc.dids.carol },
      reportAction: { ids: [row.id] },
    })
    await network.processAll()

    const { data } = await call(sc.dids.bob, 'tools.ozone.inbox.getReport', {
      id: report.id,
    })
    expect(data.report.status).toBe('resolved')
    expect(data.resolution).toMatchObject({
      outcome: 'actionTaken',
      actionTaken: 'accountTakedown',
      scope: 'network',
    })
    expect(JSON.stringify(data)).not.toContain('MODERATOR-ONLY-COMMENT')
    const { data: standing } = await call(
      sc.dids.carol,
      'tools.ozone.inbox.getAccountStatus',
    )
    expect(standing.standing).toBe('atRisk')

    const laterClose = toDatetimeString(Date.now() + 60_000)
    await network.ozone.ctx.db.db
      .updateTable('report')
      .where('id', '=', row.id)
      .set({ status: 'closed', closedAt: laterClose, updatedAt: laterClose })
      .execute()
    await network.ozone.ctx.db.db
      .insertInto('report_activity')
      .values({
        reportId: row.id,
        activityType: 'closeActivity',
        previousStatus: 'open',
        internalNote: null,
        publicNote: null,
        meta: null,
        isAutomated: false,
        createdBy: network.ozone.ctx.cfg.service.did,
        createdAt: laterClose,
      })
      .execute()
    const { data: later } = await call(
      sc.dids.bob,
      'tools.ozone.inbox.getReport',
      { id: report.id },
    )
    expect(later.resolution.outcome).toBe('other')
    expect(later.resolution.actionTaken).toBeUndefined()
  })

  it('derives account standing from strikes and active enforcement', async () => {
    const did = sc.dids.alice
    const getStanding = async () => {
      const { data } = await call(did, 'tools.ozone.inbox.getAccountStatus')
      return data
    }
    expect((await getStanding()).standing).toBe('good')
    await network.ozone.ctx.db.db
      .insertInto('account_strike')
      .values({
        did,
        activeStrikeCount: 8,
        totalStrikeCount: 8,
        firstStrikeAt: toDatetimeString(Date.now()),
        lastStrikeAt: toDatetimeString(Date.now()),
      })
      .execute()
    expect((await getStanding()).standing).toBe('warning')
    await network.ozone.ctx.db.db
      .updateTable('account_strike')
      .where('did', '=', did)
      .set({ activeStrikeCount: 12, totalStrikeCount: 12 })
      .execute()
    expect((await getStanding()).standing).toBe('atRisk')

    await network.ozone.ctx.db.db
      .updateTable('account_strike')
      .where('did', '=', did)
      .set({ activeStrikeCount: 0 })
      .execute()
    await network.ozone.ctx.db.db
      .updateTable('moderation_subject_status')
      .where('did', '=', did)
      .where('recordPath', '=', '')
      .where('convoId', '=', '')
      .set({ takendown: true })
      .execute()
    expect((await getStanding()).standing).toBe('atRisk')
  })
})
