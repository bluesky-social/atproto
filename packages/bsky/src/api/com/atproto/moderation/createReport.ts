import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { getReasonType, getSubject } from './util'
import { authVerifier } from '../../../auth'
import { softDeleted } from '../../../../db/util'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.moderation.createReport({
    auth: authVerifier,
    handler: async ({ input, auth }) => {
      const { db, services } = ctx
      const { reasonType, reason, subject } = input.body
      const requester = auth.credentials.did

      // Don't accept reports from users that are fully taken-down
      const actor = await services.actor(db).getActor(requester, true)
      if (actor && softDeleted(actor)) {
        throw new AuthRequiredError()
      }

      const moderationService = services.moderation(db)

      const report = await moderationService.report({
        reasonType: getReasonType(reasonType),
        reason,
        subject: getSubject(subject),
        reportedBy: requester,
      })

      return {
        encoding: 'application/json',
        body: moderationService.views.reportPublic(report),
      }
    },
  })
}
