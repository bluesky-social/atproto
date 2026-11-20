import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { inboxViewerDid } from '../../inbox/access.js'
import { loadReportSubjectStatuses } from '../../inbox/report-subject-status.js'
import {
  findInboxReport,
  loadReportActions,
  toReportDetail,
} from '../../inbox/reports.js'
import { tools } from '../../lexicons/index.js'
import { subjectFromEventRow } from '../../mod-service/subject.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.getReport, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const did = inboxViewerDid(auth, params.did)
      const row = await findInboxReport(
        ctx.db,
        did,
        params.id,
        ctx.cfg.inbox.startAt,
      )
      if (!row) throw new InvalidRequestError('Report not found', 'NotFound')
      const subject = subjectFromEventRow(row)
      const [events, statuses, records] = await Promise.all([
        loadReportActions(ctx.db, [row], ctx.cfg.inbox.startAt),
        loadReportSubjectStatuses(ctx.db, subject),
        subject.isRecord()
          ? ctx
              .modService(ctx.db)
              .views.fetchRecords([{ uri: subject.uri, cid: subject.cid }])
          : undefined,
      ])
      const body = toReportDetail(row, ctx.cfg.service.did, events)
      if (statuses.accountStatus)
        body.report.accountStatus = statuses.accountStatus
      if (statuses.subjectStatus)
        body.report.subjectStatus = statuses.subjectStatus
      if (subject.isRecord()) {
        const record = records?.get(subject.uri)?.value
        if (record !== undefined) {
          body.report.record = record as NonNullable<typeof body.report.record>
        }
      }
      return {
        encoding: 'application/json',
        body,
      }
    },
  })
}
