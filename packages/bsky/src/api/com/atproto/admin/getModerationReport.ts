import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import {
  isRecordView,
  isRepoView,
} from '../../../../lexicon/types/com/atproto/admin/defs'
import { addAccountInfoToRepoView, getPdsAccountInfo } from './util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationReport({
    auth: ctx.roleVerifier,
    handler: async ({ params, auth }) => {
      const { id } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const result = await moderationService.getReportOrThrow(id)
      const [report, accountInfo] = await Promise.all([
        moderationService.views.reportDetail(result),
        getPdsAccountInfo(ctx, result.subjectDid),
      ])

      // add in pds account info if available
      if (isRepoView(report.subject)) {
        report.subject = addAccountInfoToRepoView(
          report.subject,
          accountInfo,
          auth.credentials.moderator,
        )
      } else if (isRecordView(report.subject)) {
        report.subject.repo = addAccountInfoToRepoView(
          report.subject.repo,
          accountInfo,
          auth.credentials.moderator,
        )
      }

      return {
        encoding: 'application/json',
        body: report,
      }
    },
  })
}
