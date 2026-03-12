import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

const MAX_REPORTS = 5000

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.queue.routeReports({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const { startReportId, endReportId } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be an admin to re-route reports')
      }
      if (startReportId > endReportId) {
        throw new InvalidRequestError(
          'startReportId must be less than or equal to endReportId',
        )
      }
      if (endReportId - startReportId + 1 > MAX_REPORTS) {
        throw new InvalidRequestError(
          `Cannot route more than ${MAX_REPORTS} reports at a time`,
          'OutOfRange',
        )
      }

      const queueService = ctx.queueService(ctx.db)
      const { assigned, unmatched } = await queueService.assignReportBatch(
        { start: startReportId, end: endReportId, limit: MAX_REPORTS },
        { includeUnmatched: true },
      )

      return {
        encoding: 'application/json' as const,
        body: {
          assigned,
          unmatched,
        },
      }
    },
  })
}
