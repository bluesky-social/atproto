import { AuthRequiredError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import {
  getSafelinkAction,
  getSafelinkPattern,
  getSafelinkReason,
} from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.safelink.addRule({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { url, pattern, action, reason, comment, createdBy } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to add URL rules')
      }

      if (access.type === 'admin_token' && !createdBy) {
        throw new AuthRequiredError(
          'Must specify createdBy when using admin auth',
        )
      }

      const safelinkRuleService = ctx.safelinkRuleService(db)

      const event = await safelinkRuleService.addRule({
        url,
        pattern: getSafelinkPattern(pattern),
        action: getSafelinkAction(action),
        reason: getSafelinkReason(reason),
        createdBy:
          access.type === 'admin_token'
            ? createdBy || ctx.cfg.service.did
            : access.iss,
        comment,
      })

      return {
        encoding: 'application/json',
        body: safelinkRuleService.formatEvent(event),
      }
    },
  })
}
