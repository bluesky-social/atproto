import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { addAccountInfoToRepoView, getPdsAccountInfo } from './util'
import {
  isRecordView,
  isRepoView,
} from '../../../../lexicon/types/com/atproto/admin/defs'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.getModerationAction({
    auth: ctx.roleVerifier,
    handler: async ({ params, auth }) => {
      const { id } = params
      const db = ctx.db.getPrimary()
      const moderationService = ctx.services.moderation(db)
      const result = await moderationService.getActionOrThrow(id)

      const [action, accountInfo] = await Promise.all([
        moderationService.views.actionDetail(result),
        getPdsAccountInfo(ctx, result.subjectDid),
      ])

      // add in pds account info if available
      if (isRepoView(action.subject)) {
        action.subject = addAccountInfoToRepoView(
          action.subject,
          accountInfo,
          auth.credentials.moderator,
        )
      } else if (isRecordView(action.subject)) {
        action.subject.repo = addAccountInfoToRepoView(
          action.subject.repo,
          accountInfo,
          auth.credentials.moderator,
        )
      }

      return {
        encoding: 'application/json',
        body: action,
      }
    },
  })
}
