import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { TimeIdKeyset, paginate } from '../../db/pagination'
import {
  actionEventTypes,
  modEventToEventView,
} from '../../history/views'
import { Server } from '../../lexicon'
import { ReportedSubjectView } from '../../lexicon/types/tools/ozone/history/defs'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.history.getReportedSubjects({
    auth: ctx.authVerifier.standardOptionalOrAdminToken,
    handler: async ({ auth, params }) => {
      const access = auth.credentials
      const { limit, cursor, account, sortDirection } = params
      const db = ctx.db

      // Allow admins to check mod history for any reporter
      let viewerDid: string | null
      if (access.type === 'admin_token') {
        if (!account) {
          throw new Error('Admins must provide an account param')
        }
        viewerDid = account
      } else if (access.iss) {
        viewerDid = access.iss
      } else {
        throw new InvalidRequestError('unauthorized')
      }

      const { ref } = db.db.dynamic
      const builder = db.db
        .selectFrom('report')
        .where('createdBy', '=', viewerDid)
        .selectAll()

      const keyset = new TimeIdKeyset(
        ref('report.createdAt'),
        ref('report.id'),
      )
      const paginatedBuilder = paginate(builder, {
        limit,
        cursor,
        keyset,
        direction: sortDirection === 'asc' ? 'asc' : 'desc',
      })

      const reports = await paginatedBuilder.execute()

      // Collect all actionEventIds to batch-fetch events
      const allEventIds = new Set<number>()
      for (const report of reports) {
        if (report.actionEventIds) {
          for (const id of report.actionEventIds) {
            allEventIds.add(id)
          }
        }
      }

      // Batch fetch action events
      const eventMap = new Map<number, ReturnType<typeof modEventToEventView>>()
      if (allEventIds.size > 0) {
        const events = await db.db
          .selectFrom('moderation_event')
          .where('id', 'in', Array.from(allEventIds))
          .where('action', 'in', [...actionEventTypes])
          .selectAll()
          .execute()

        for (const event of events) {
          const view = modEventToEventView(event)
          if (view) {
            eventMap.set(event.id, view)
          }
        }
      }

      const subjects: ReportedSubjectView[] = reports.map((report) => {
        const subject = report.recordPath
          ? AtUri.make(
              report.did,
              ...report.recordPath.split('/'),
            ).toString()
          : report.did

        const actions = (report.actionEventIds || [])
          .map((id) => eventMap.get(id))
          .filter((v): v is NonNullable<typeof v> => v !== null && v !== undefined)

        return {
          subject,
          comment: report.comment || undefined,
          createdAt: report.createdAt,
          status: report.status,
          actions,
        }
      })

      return {
        encoding: 'application/json',
        body: {
          subjects,
          cursor: keyset.packFromResult(reports),
        },
      }
    },
  })
}
