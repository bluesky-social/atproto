import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.getAssignments({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const { onlyActiveAssignments, queueIds, dids, subject } = params
      const db = ctx.db

      let query = db.db.selectFrom('moderator_assignment').selectAll()

      if (onlyActiveAssignments) {
        query = query.where('endAt', '>', new Date())
      }

      if (queueIds?.length) {
        query = query.where('queueId', 'in', queueIds)
      }

      if (dids?.length) {
        query = query.where('did', 'in', dids)
      }

      if (subject) {
        if (subject.startsWith('at://')) {
          // AT-URI: return assignments for that specific URI's report
          query = query.where('reportId', 'is not', null)
        } else {
          // DID: return assignments for all records and the DID
          query = query.where('did', '=', subject)
        }
      }

      const results = await query.execute()

      return {
        encoding: 'application/json' as const,
        body: {
          assignments: results.map((row) => ({
            id: row.id,
            did: row.did,
            handle: row.handle ?? undefined,
            displayName: row.displayName ?? undefined,
            reportId: row.reportId ?? undefined,
            queueId: row.queueId!,
            startAt: row.startAt.toISOString(),
            endAt: row.endAt.toISOString(),
          })),
        },
      }
    },
  })
}
