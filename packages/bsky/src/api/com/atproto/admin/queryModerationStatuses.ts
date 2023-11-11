import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getReviewState } from '../moderation/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.queryModerationStatuses({
    auth: ctx.roleVerifier,
    handler: async ({ params }) => {
      const {
        subject,
        takendown,
        reviewState,
        reviewedAfter,
        reviewedBefore,
        reportedAfter,
        reportedBefore,
        ignoreSubjects,
        lastReviewedBy,
        sortDirection = 'desc',
        sortField = 'lastReportedAt',
        includeMuted = false,
        limit = 50,
        cursor,
      } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const results = await moderationService.getSubjectStatuses({
        reviewState: getReviewState(reviewState),
        subject,
        takendown,
        reviewedAfter,
        reviewedBefore,
        reportedAfter,
        reportedBefore,
        includeMuted,
        ignoreSubjects,
        sortDirection,
        lastReviewedBy,
        sortField,
        limit,
        cursor,
      })
      const subjectStatuses = moderationService.views.subjectStatus(
        results.statuses,
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
