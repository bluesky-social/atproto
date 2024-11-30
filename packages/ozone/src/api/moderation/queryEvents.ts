import { Server } from '../../lexicon'
import AppContext from '../../context'
import { getEventType } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.queryEvents({
    auth: ctx.authVerifier.modOrAdminToken,
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
        collections = [],
        subjectType,
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
        collections,
        subjectType,
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
