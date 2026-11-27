import { ids } from '@atproto/api'
import { com, tools } from '../src/lexicons/index.js'
import {
  CHAT_CONVO_COLLECTION,
  CHAT_MESSAGE_COLLECTION,
} from '../src/mod-service/subject.js'
import { setupCloseReports } from './_close-reports.js'

describe('report-close-reports active review', () => {
  const t = setupCloseReports('ozone_report_close_reports_active_review')
  const {
    closeReports,
    listActivities,
    fixture,
    reports,
    detail,
    setStatus,
    snapshotReports,
    expectUnchanged,
    modHeaders,
  } = t

  describe.each(['account', 'record', 'message', 'conversation'] as const)(
    '%s active review',
    (kind) => {
      it.each([false, true])(
        'preserves active review during batch closure when isAutomated is %s',
        async (isAutomated) => {
          const f = await fixture()
          const [
            open,
            queued,
            assigned,
            permanent,
            escalated,
            temporary,
            ended,
            excluded,
          ] = await reports([
            f[kind],
            f[kind],
            f[kind],
            f[kind],
            f[kind],
            f[kind],
            f[kind],
            {
              subject: f[kind],
              reasonType: com.atproto.moderation.defs.ReasonRude,
            },
          ])
          await setStatus(queued.id, 'queued')
          await setStatus(assigned.id, 'assigned')
          await setStatus(permanent.id, 'assigned')
          await setStatus(permanent.id, 'queued')
          await setStatus(escalated.id, 'escalated')
          await t.agent.tools.ozone.report.assignModerator(
            { reportId: temporary.id },
            { headers: await modHeaders(ids.ToolsOzoneReportAssignModerator) },
          )
          await setStatus(ended.id, 'assigned')
          await t.agent.tools.ozone.report.unassignModerator(
            { reportId: ended.id },
            {
              headers: await modHeaders(ids.ToolsOzoneReportUnassignModerator),
            },
          )
          const before = await snapshotReports([
            assigned,
            permanent,
            escalated,
            excluded,
          ])
          const subject =
            kind === 'account'
              ? f.did
              : kind === 'record'
                ? f.record.uri
                : `at://${f.did}/${kind === 'message' ? CHAT_MESSAGE_COLLECTION : CHAT_CONVO_COLLECTION}/${kind === 'message' ? f.message.messageId : f.conversation.convoId}`
          const input = {
            subject,
            reportTypes: [
              com.atproto.moderation.defs.ReasonSpam,
              com.atproto.moderation.defs.ReasonRude,
            ],
            excludedReportTypes: [com.atproto.moderation.defs.ReasonRude],
            isAutomated,
          }
          expect((await closeReports(input)).data).toEqual({
            closedCount: 4,
            reportIds: [open.id, queued.id, temporary.id, ended.id],
          })
          for (const r of [open, queued, temporary, ended]) {
            expect((await detail(r.id)).status).toBe('closed')
            expect(await listActivities(r.id)).toContainEqual(
              expect.objectContaining({
                isAutomated,
                meta: { resolution: 'noAction' },
              }),
            )
          }
          expect((await closeReports(input)).data).toEqual({
            closedCount: 0,
            reportIds: [],
          })
          await expectUnchanged(before)

          for (const r of [assigned, permanent, escalated]) {
            await t.agent.tools.ozone.report.createActivity(
              {
                reportId: r.id,
                activity: tools.ozone.report.defs.closeActivity.$build({}),
              },
              { headers: await modHeaders(ids.ToolsOzoneReportCreateActivity) },
            )
            expect((await detail(r.id)).status).toBe('closed')
          }
        },
      )
    },
  )
})
