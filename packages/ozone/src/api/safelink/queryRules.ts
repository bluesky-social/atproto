import { AuthRequiredError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getSafelinkAction, getSafelinkReason } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.safelink.queryRules({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const {
        cursor,
        limit,
        urls,
        domains,
        actions,
        reason,
        createdBy,
        sortDirection,
      } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to query URL rules')
      }

      const safelinkService = ctx.safelinkService(db)
      const result = await safelinkService.getActiveRules({
        cursor,
        limit,
        urls,
        domains,
        actions:
          actions && actions.length > 0
            ? actions.map(getSafelinkAction)
            : undefined,
        reason: reason ? getSafelinkReason(reason) : undefined,
        createdBy,
        direction: sortDirection as 'asc' | 'desc' | undefined,
      })

      return {
        encoding: 'application/json',
        body: {
          cursor: result.cursor,
          rules: result.rules.map((rule) => ({
            url: rule.url,
            pattern: rule.pattern,
            action: rule.action,
            reason: rule.reason,
            createdBy: rule.createdBy,
            createdAt: new Date(rule.createdAt).toISOString(),
            comment: rule.comment || undefined,
          })),
        },
      }
    },
  })
}
