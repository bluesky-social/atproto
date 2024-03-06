import { Server } from '../../lexicon'
import AppContext from '../../context'
import { getReviewState } from '../moderation/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.queryModerationStatuses({
    auth: ctx.authVerifier.modOrRole,
    handler: async ({ params }) => {
      const {
        subject,
        takendown,
        appealed,
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
        tags = [],
        excludeTags = [],
      } = params
      const db = ctx.db
      const modService = ctx.modService(db)
      const results = await modService.getSubjectStatuses({
        reviewState: getReviewState(reviewState),
        subject,
        takendown,
        appealed,
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
        tags,
        excludeTags,
      })
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
