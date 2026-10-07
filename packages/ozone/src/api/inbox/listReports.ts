import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { inboxViewerDid } from '../../inbox/access.js'
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
      const did = inboxViewerDid(auth, params.did)
      const seenAt = await getSeenAt(ctx.db, did, 'reports')
      const { rows, cursor } = await queryInboxReports(
        ctx.db,
        did,
        params,
        seenAt,
        ctx.cfg.inbox.startAt,
      )
      const events = await loadReportActions(
        ctx.db,
        rows,
        ctx.cfg.inbox.startAt,
      )
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
