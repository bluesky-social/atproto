import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import {
  loadReportActions,
  queryInboxReports,
  toReportListView,
} from '../../inbox/reports.js'
import { getSeenAt } from '../../inbox/seen.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.inbox.listReports, {
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const did = auth.credentials.iss
      const seenAt = await getSeenAt(ctx.db, did, 'reports')
      const { rows, cursor } = await queryInboxReports(
        ctx.db,
        did,
        params,
        seenAt,
      )
      const events = await loadReportActions(ctx.db, rows)
      return {
        encoding: 'application/json',
        body: {
          cursor,
          reports: rows.map((row) =>
            toReportListView(row, ctx.cfg.service.did, seenAt, events),
          ),
        },
      }
    },
  })
}
