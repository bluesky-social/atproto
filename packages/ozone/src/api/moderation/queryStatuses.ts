import { InvalidRequestError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.moderation.queryStatuses, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, signal }) => {
      // @NOTE Unknown query parameters are retained as strings. Reject retired
      // filters rather than silently returning a broader moderation queue.
      const queryParams = params as Record<string, unknown>
      for (const name of [
        'minAccountSuspendCount',
        'minReportedRecordsCount',
        'minTakendownRecordsCount',
      ]) {
        const value = queryParams[name]
        if (value === undefined) continue
        if (
          typeof value !== 'string' ||
          !/^-?\d+$/.test(value) ||
          !Number.isSafeInteger(Number(value)) ||
          Number(value) > 0
        ) {
          throw new InvalidRequestError(
            'Count-based status filters are no longer supported',
          )
        }
      }
      const db = ctx.db
      const modService = ctx.modService(db)
      const results = await modService.getSubjectStatuses({ ...params, signal })
      const subjectStatuses = results.statuses.map((status) =>
        modService.views.formatSubjectStatus(status),
      )
      return {
        encoding: 'application/json',
        body: {
          cursor: results.cursor,
          subjectStatuses,
        },
      }
    },
  })
}
