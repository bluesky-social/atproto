import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getEventType } from '../moderation/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.queryModerationEvents({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const {
        subject,
        limit = 50,
        cursor,
        sortDirection = 'desc',
        types,
        includeAllUserRecords = false,
        createdBy,
      } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const results = await moderationService.getEvents({
        types: types?.length ? types.map(getEventType) : [],
        subject,
        createdBy,
        limit,
        cursor,
        sortDirection,
        includeAllUserRecords,
      })
      return {
        encoding: 'application/json',
        body: {
          cursor: results.cursor,
          events: await moderationService.views.event(results.events),
        },
      }
    },
  })
}
