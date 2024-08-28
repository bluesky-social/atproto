import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.history.getReportedSubjects({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth, params }) => {
      const access = auth.credentials
      const { limit, cursor, account, sortDirection } = params
      const db = ctx.db

      const modHistoryService = ctx.modStatusHistoryService(db)
      const results = await modHistoryService.getStatusesForReporter({
        reporterDid: access.iss,
        limit,
        cursor,
        account,
        sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
      })

      return {
        encoding: 'application/json',
        body: {
          subjects: results.statuses.map((item) => {
            return {
              subject: modHistoryService.basicView({ ...item }),
              report: {
                createdAt: item.createdAt,
                reason: item.comment || '',
                reasonType: item.meta?.reportType
                  ? `${item.meta.reportType}`
                  : '',
              },
            }
          }),
          cursor: results.cursor,
        },
      }
    },
  })
}
