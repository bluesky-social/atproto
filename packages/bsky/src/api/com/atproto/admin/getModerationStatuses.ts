import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getReviewState } from '../moderation/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationStatuses({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const {
        subject,
        reviewState,
        reviewedAfter,
        reviewedBefore,
        reportedAfter,
        reportedBefore,
        includeMuted = false,
        limit = 50,
        cursor,
      } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const results = await moderationService.getSubjectStatuses({
        reviewState: getReviewState(reviewState),
        subject,
        reviewedAfter,
        reviewedBefore,
        reportedAfter,
        reportedBefore,
        includeMuted,
        limit,
        cursor,
      })
      const subjectStatuses = await moderationService.views.subjectStatus(
        results,
      )
      const newCursor = results.at(-1)?.id.toString() ?? undefined
      return {
        encoding: 'application/json',
        body: {
          cursor: newCursor,
          subjectStatuses,
        },
      }
    },
  })
}
