import { AuthRequiredError, type Server } from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'
import {
  getSafelinkAction,
  getSafelinkPattern,
  getSafelinkReason,
} from '../util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.safelink.syncSource, {
    auth: ctx.authVerifier.modOrAdminToken,
    opts: { jsonLimit: 5 * 1024 * 1024 },
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to sync URL rules')
      }

      const { source, rules } = input.body
      const result = await ctx.safelinkRuleService(ctx.db).syncSource(
        source,
        rules.map((rule) => ({
          url: rule.url,
          pattern: getSafelinkPattern(rule.pattern),
          action: getSafelinkAction(rule.action),
          reason: getSafelinkReason(rule.reason),
        })),
        access.type === 'admin_token' ? ctx.cfg.service.did : access.iss,
      )

      return { encoding: 'application/json', body: result }
    },
  })
}
