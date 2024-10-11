import { Server } from '../../lexicon'
import AppContext from '../../context'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { SubjectBasicView } from '../../lexicon/types/tools/ozone/history/defs'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.history.getAccountActions({
    auth: ctx.authVerifier.standardOptionalOrAdminToken,
    handler: async ({ auth, params }) => {
      const access = auth.credentials
      const { limit, cursor, account, sortDirection } = params
      const db = ctx.db

      // Allow admins to check mod history for any reporter
      let authorDid: string | null
      if (access.type === 'admin_token') {
        if (!account) {
          throw new Error('Admins must provide an account param')
        }
        authorDid = account
      } else if (access.iss) {
        authorDid = access.iss
      } else {
        throw new InvalidRequestError('unauthorized')
      }

      const modHistoryService = ctx.modStatusHistoryService(db)
      const results = await modHistoryService.getStatusesForAccount({
        authorDid,
        limit,
        cursor,
        sortDirection: sortDirection === 'asc' ? 'asc' : 'desc',
      })

      const subjects: SubjectBasicView[] = []

      results.statuses.forEach((item) => {
        const view = modHistoryService.basicViewFromModerationStatus(item)
        if (view) {
          subjects.push(view)
        }
      })

      return {
        encoding: 'application/json',
        body: {
          subjects,
          cursor: results.cursor,
        },
      }
    },
  })
}
