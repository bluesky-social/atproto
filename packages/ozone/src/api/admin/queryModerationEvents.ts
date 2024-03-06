import { Server } from '../../lexicon'
import AppContext from '../../context'
import { getEventType } from '../moderation/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.queryModerationEvents({
    auth: ctx.authVerifier.modOrRole,
    handler: async ({ params }) => {
      const {
        subject,
        limit = 50,
        cursor,
        sortDirection = 'desc',
        types,
        includeAllUserRecords = false,
        hasComment,
        comment,
        createdBy,
        createdAfter,
        createdBefore,
        addedLabels = [],
        removedLabels = [],
        addedTags = [],
        removedTags = [],
        reportTypes,
      } = params
      const db = ctx.db
      const modService = ctx.modService(db)
      const results = await modService.getEvents({
        types: types?.length ? types.map(getEventType) : [],
        subject,
        createdBy,
        limit,
        cursor,
        sortDirection,
        includeAllUserRecords,
        hasComment,
        comment,
        createdAfter,
        createdBefore,
        addedLabels,
        addedTags,
        removedLabels,
        removedTags,
        reportTypes,
      })
      return {
        encoding: 'application/json',
        body: {
          cursor: results.cursor,
          events: results.events.map((evt) =>
            modService.views.formatEvent(evt),
          ),
        },
      }
    },
  })
}
