import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.routeReports({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials

      if (!access.isAdmin) {
        throw new AuthRequiredError('Must be an admin to route reports')
      }

      const { startReportId, endReportId } = input.body

      if (startReportId > endReportId) {
        throw new InvalidRequestError(
          'startReportId must be less than or equal to endReportId',
        )
      }

      return {
        encoding: 'application/json' as const,
        body: {
          assigned: 0,
          unmatched: 0,
        },
      }
    },
  })
}
