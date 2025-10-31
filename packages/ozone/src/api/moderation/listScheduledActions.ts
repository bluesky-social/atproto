import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getScheduledActionStatus } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.listScheduledActions({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input }) => {
      const db = ctx.db
      const {
        startsAfter,
        endsBefore,
        subjects,
        statuses,
        limit = 50,
        cursor,
      } = input.body

      const scheduledActionService = ctx.scheduledActionService(db)

      const parsedStatuses = statuses.map((status) =>
        getScheduledActionStatus(status),
      )

      const result = await scheduledActionService.listScheduledActions({
        cursor,
        limit,
        startTime: startsAfter ? new Date(startsAfter) : undefined,
        endTime: endsBefore ? new Date(endsBefore) : undefined,
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
