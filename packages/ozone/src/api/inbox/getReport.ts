import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import {
  findInboxReport,
  loadReportActions,
  toReportDetail,
} from '../../inbox/reports.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.getReport, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const row = await findInboxReport(ctx.db, auth.credentials.iss, params.id)
      if (!row) throw new InvalidRequestError('Report not found', 'NotFound')
      const events = await loadReportActions(ctx.db, [row])
      return {
        encoding: 'application/json',
        body: toReportDetail(row, ctx.cfg.service.did, events),
      }
    },
  })
}
