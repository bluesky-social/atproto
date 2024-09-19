import { Server } from '../../lexicon'
import AppContext from '../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.history.getReportedSubjects({
    auth: ctx.authVerifier.standardOptionalOrAdminToken,
    handler: async ({ auth, params }) => {
      const access = auth.credentials
      const { limit, cursor, account, sortDirection } = params
      const db = ctx.db

      // Allow admins to check mod history for any reporter
      let reporterDid: string | null
      if (access.type === 'admin_token') {
        if (!account) {
          throw new Error('Admins must provide an account param')
        }
        reporterDid = account
      } else if (access.iss) {
        reporterDid = access.iss
      } else {
        throw new InvalidRequestError('unauthorized')
      }

      const modHistoryService = ctx.modStatusHistoryService(db)
      const results = await modHistoryService.getStatusesForReporter({
        reporterDid,
        limit,
        cursor,
        account,
        sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
      })

      return {
        encoding: 'application/json',
        body: {
          subjects: results.statuses.map((item) =>
            modHistoryService.basicView(item),
          ),
          cursor: results.cursor,
        },
      }
    },
  })
}
