import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getSafelinkPattern } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.safelink.queryEvents({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input }) => {
      const db = ctx.db
      const { cursor, limit, urls, patternType, sortDirection } = input.body

      const safelinkRuleService = ctx.safelinkRuleService(db)
      const result = await safelinkRuleService.queryEvents({
        cursor,
        limit,
        urls,
        patternType: patternType ? getSafelinkPattern(patternType) : undefined,
        direction: sortDirection as 'asc' | 'desc' | undefined,
      })

      return {
        encoding: 'application/json',
        body: {
          cursor: result.cursor,
          events: result.events.map((event) =>
            safelinkRuleService.formatEvent(event),
          ),
        },
      }
    },
  })
}
