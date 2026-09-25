import { ComAtprotoModerationDefs } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { type DidString, toDatetimeString } from '@atproto/lex'

describe('moderator inbox preview', () => {
  let network: TestNetwork
  let sc: SeedClient
  let aliceReportId: number
  let danReportId: number

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_preview',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    await network.ozone.addModeratorDid(sc.dids.bob)
    await network.ozone.addTriageDid(sc.dids.carol)

    const subject = { $type: 'com.atproto.admin.defs#repoRef' as const }
    const aliceReport = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: { ...subject, did: sc.dids.bob },
      reportedBy: sc.dids.alice,
    })
    const danReport = await sc.createReport({
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: { ...subject, did: sc.dids.bob },
      reportedBy: sc.dids.dan,
    })
    aliceReportId = aliceReport.id
    danReportId = danReport.id
    await network.processAll()

    const mod = network.ozone.getModClient()
    for (const did of [sc.dids.alice, sc.dids.dan]) {
      await mod.emitEvent({
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['spam'],
          negateLabelVals: [],
        },
        subject: { ...subject, did },
      })
    }
    await network.ozone.ctx.db.db
      .insertInto('inbox_seen')
      .values([
        {
          did: sc.dids.alice,
          section: 'reports',
          seenAt: toDatetimeString(Date.now() + 60_000),
        },
        {
          did: sc.dids.alice,
          section: 'subjects',
          seenAt: toDatetimeString(Date.now() + 60_000),
        },
      ])
      .execute()
  })

  afterAll(async () => network?.close())

  function call(did: DidString, method: string, params: object = {}) {
    return sc.agent.call(method, params, undefined, {
      headers: {
        ...sc.getHeaders(did),
        'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
      },
    })
  }

  it('previews only the target reports and uses the target seen state', async () => {
    const method = 'tools.ozone.inbox.listReports'
    const { data: own } = await call(sc.dids.dan, method)
    const { data: self } = await call(sc.dids.dan, method, {
      did: sc.dids.dan,
    })
    expect(self).toEqual(own)
    expect(own.reports.map((report: { id: number }) => report.id)).toContain(
      danReportId,
    )

    for (const viewer of [sc.dids.bob, sc.dids.carol]) {
      const { data: target } = await call(viewer, method, {
        did: sc.dids.alice,
      })
      expect(target.reports).toEqual([
        expect.objectContaining({ id: aliceReportId, isRead: true }),
      ])
      expect(
        target.reports.map((report: { id: number }) => report.id),
      ).not.toContain(danReportId)
      const { data: unread } = await call(viewer, method, {
        did: sc.dids.alice,
        filter: 'unread',
      })
      expect(unread.reports).toHaveLength(0)
      const { data: other } = await call(viewer, method, {
        did: sc.dids.dan,
      })
      expect(other.reports).toEqual([
        expect.objectContaining({ id: danReportId, isRead: false }),
      ])
    }
  })

  it('previews only the target subjects and uses the target seen state', async () => {
    const method = 'tools.ozone.inbox.listActionedSubjects'
    const { data: own } = await call(sc.dids.dan, method)
    const { data: self } = await call(sc.dids.dan, method, {
      did: sc.dids.dan,
    })
    expect(self).toEqual(own)
    expect(own.subjects).toEqual([
      expect.objectContaining({
        subject: expect.objectContaining({ did: sc.dids.dan }),
        isRead: false,
      }),
    ])

    for (const viewer of [sc.dids.bob, sc.dids.carol]) {
      const { data: target } = await call(viewer, method, {
        did: sc.dids.alice,
      })
      expect(target.subjects).toEqual([
        expect.objectContaining({
          subject: expect.objectContaining({ did: sc.dids.alice }),
          isRead: true,
        }),
      ])
      const { data: other } = await call(viewer, method, {
        did: sc.dids.dan,
      })
      expect(other.subjects).toEqual(own.subjects)
    }
  })

  it('rejects cross-account preview by an ordinary or disabled member', async () => {
    for (const method of [
      'tools.ozone.inbox.listReports',
      'tools.ozone.inbox.listActionedSubjects',
    ]) {
      await expect(
        call(sc.dids.dan, method, { did: sc.dids.alice }),
      ).rejects.toMatchObject({ error: 'Forbidden' })
    }

    await network.ozone.ctx.db.db
      .updateTable('member')
      .where('did', '=', sc.dids.bob)
      .set({ disabled: true })
      .execute()
    for (const method of [
      'tools.ozone.inbox.listReports',
      'tools.ozone.inbox.listActionedSubjects',
    ]) {
      await expect(
        call(sc.dids.bob, method, { did: sc.dids.alice }),
      ).rejects.toMatchObject({ error: 'MemberDisabled' })
    }
  })
})
