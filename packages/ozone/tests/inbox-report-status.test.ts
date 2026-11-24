import { ComAtprotoModerationDefs } from '@atproto/api'
import { TestNetwork, basicSeed } from '@atproto/dev-env'
import { tools } from '../src/lexicons/index.js'
import { reportForEvent } from './_inbox.js'

describe('moderation inbox report subject status', () => {
  it('returns current account and record state only on the owned detail', async () => {
    const network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_inbox_report_status',
    })
    try {
      const sc = network.getSeedClient()
      const mod = network.ozone.getModClient()
      await basicSeed(sc)
      const { did } = await sc.createAccount('report-status', {
        handle: 'report-status.test',
        email: 'report-status@test.com',
        password: 'password',
      })
      const post = await sc.post(did, 'A reported post')
      await network.processAll()
      const record = {
        $type: 'com.atproto.repo.strongRef' as const,
        uri: post.ref.uriStr,
        cid: post.ref.cidStr,
      }
      const account = {
        $type: 'com.atproto.admin.defs#repoRef' as const,
        did,
      }
      const event = await sc.createReport({
        reportedBy: sc.dids.bob,
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: record,
      })
      const accountEvent = await sc.createReport({
        reportedBy: sc.dids.bob,
        reasonType: ComAtprotoModerationDefs.REASONSPAM,
        subject: account,
      })
      await network.processAll()
      const id = (await reportForEvent(mod, event.id)).id
      const accountReportId = (await reportForEvent(mod, accountEvent.id)).id
      const call = (viewer: typeof sc.dids.bob, method: string, params = {}) =>
        sc.agent.call(method, params, undefined, {
          headers: {
            ...sc.getHeaders(viewer),
            'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
          },
        })
      const detail = async () =>
        (await call(sc.dids.bob, tools.ozone.inbox.getReport.$lxm, { id })).data

      const before = await detail()
      expect(before.report.subjectStatus).toEqual({ takendown: false })
      expect(before.report.status).toBe('pending')

      await mod.emitEvent({
        event: {
          $type: tools.ozone.moderation.defs.modEventTakedown.$type,
          durationInHours: 24,
        },
        subject: account,
      })
      await mod.emitEvent(
        {
          event: {
            $type: tools.ozone.moderation.defs.accountEvent.$type,
            active: false,
            status: 'deleted',
            timestamp: new Date().toISOString(),
          },
          subject: account,
        },
        'admin',
      )
      await mod.emitEvent(
        {
          event: {
            $type: tools.ozone.moderation.defs.recordEvent.$type,
            op: 'delete',
            timestamp: new Date().toISOString(),
          },
          subject: record,
        },
        'admin',
      )

      const unavailable = await detail()
      expect(unavailable.report).toMatchObject({
        status: 'pending',
        accountStatus: { enforcement: 'suspended', hosting: 'deleted' },
        subjectStatus: { takendown: false, deleted: true },
      })
      expect(unavailable.resolution).toBeUndefined()
      const accountDetail = await call(
        sc.dids.bob,
        tools.ozone.inbox.getReport.$lxm,
        { id: accountReportId },
      )
      expect(accountDetail.data.report.accountStatus).toEqual({
        enforcement: 'suspended',
        hosting: 'deleted',
      })
      expect(accountDetail.data.report.subjectStatus).toBeUndefined()

      await network.ozone.ctx.db.db
        .updateTable('moderation_subject_status')
        .set({ suspendUntil: '2020-01-01T00:00:00.000Z' })
        .where('did', '=', did)
        .where('recordPath', '=', '')
        .where('convoId', '=', '')
        .execute()
      expect((await detail()).report.accountStatus.enforcement).toBe(
        'suspended',
      )

      const page = await call(sc.dids.bob, tools.ozone.inbox.listReports.$lxm)
      const listItem = page.data.reports.find(
        (r: { id: number }) => r.id === id,
      )
      expect(listItem.accountStatus).toBeUndefined()
      expect(listItem.subjectStatus).toBeUndefined()
      await expect(
        call(sc.dids.carol, tools.ozone.inbox.getReport.$lxm, { id }),
      ).rejects.toMatchObject({ error: 'NotFound' })

      await mod.emitEvent({
        event: { $type: tools.ozone.moderation.defs.modEventTakedown.$type },
        subject: record,
      })
      await mod.emitEvent(
        {
          event: {
            $type: tools.ozone.moderation.defs.recordEvent.$type,
            op: 'create',
            timestamp: new Date().toISOString(),
          },
          subject: record,
        },
        'admin',
      )
      expect((await detail()).report.subjectStatus).toEqual({
        takendown: true,
        deleted: false,
      })
    } finally {
      await network.close()
    }
  })
})
