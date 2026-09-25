import {
  ForbiddenError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
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
      const did = params.did ?? auth.credentials.iss
      if (
        did !== auth.credentials.iss &&
        !(
          auth.credentials.isModerator ||
          auth.credentials.isTriage ||
          auth.credentials.isAdmin
        )
      ) {
        throw new ForbiddenError('Unauthorized')
      }
      const row = await findInboxReport(ctx.db, did, params.id)
      if (!row) throw new InvalidRequestError('Report not found', 'NotFound')
      const events = await loadReportActions(ctx.db, [row])
      return {
        encoding: 'application/json',
        body: toReportDetail(row, ctx.cfg.service.did, events),
      }
    },
  })
}
