import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getScheduledActionStatus } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.listScheduledActions({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input }) => {
      const db = ctx.db
      const {
        startTime,
        endTime,
        subjects,
        statuses,
        limit = 50,
        cursor,
      } = input.body

      const scheduledActionService = ctx.scheduledActionService(db)

      const parsedStatuses = statuses?.map((status) =>
        getScheduledActionStatus(status),
      )

      const result = await scheduledActionService.listScheduledActions({
        cursor,
        limit,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        subjects,
        statuses: parsedStatuses,
      })

      return {
        encoding: 'application/json',
        body: {
          actions: result.actions.map((action) =>
            scheduledActionService.formatScheduledAction(action),
          ),
          cursor: result.cursor,
        },
      }
    },
  })
}
