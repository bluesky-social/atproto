import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import {
  getSafelinkAction,
  getSafelinkPattern,
  getSafelinkReason,
} from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.safelink.queryRules({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input }) => {
      const db = ctx.db
      const {
        cursor,
        limit,
        urls,
        patternType,
        actions,
        reason,
        createdBy,
        sortDirection,
      } = input.body

      const safelinkRuleService = ctx.safelinkRuleService(db)
      const result = await safelinkRuleService.getActiveRules({
        cursor,
        limit,
        urls,
        patternType: patternType ? getSafelinkPattern(patternType) : undefined,
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
            updatedAt: new Date(rule.updatedAt).toISOString(),
            comment: rule.comment || undefined,
          })),
        },
      }
    },
  })
}
