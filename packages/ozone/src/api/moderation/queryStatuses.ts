import { Server } from '../../lexicon'
import AppContext from '../../context'
import { getReviewState } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderation.queryStatuses({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params }) => {
      const {
        includeAllUserRecords,
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
        hostingDeletedBefore,
        hostingDeletedAfter,
        hostingUpdatedBefore,
        hostingUpdatedAfter,
        hostingStatuses,
        sortDirection = 'desc',
        sortField = 'lastReportedAt',
        includeMuted = false,
        onlyMuted = false,
        limit = 50,
        cursor,
        tags = [],
        excludeTags = [],
        collections = [],
        subjectType,
      } = params
      const db = ctx.db
      const modService = ctx.modService(db)
      const results = await modService.getSubjectStatuses({
        reviewState: getReviewState(reviewState),
        includeAllUserRecords,
        subject,
        takendown,
        appealed,
        reviewedAfter,
        reviewedBefore,
        reportedAfter,
        reportedBefore,
        includeMuted,
        hostingDeletedBefore,
        hostingDeletedAfter,
        hostingUpdatedBefore,
        hostingUpdatedAfter,
        hostingStatuses,
        onlyMuted,
        ignoreSubjects,
        sortDirection,
        lastReviewedBy,
        sortField,
        limit,
        cursor,
        tags,
        excludeTags,
        collections,
        subjectType,
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
