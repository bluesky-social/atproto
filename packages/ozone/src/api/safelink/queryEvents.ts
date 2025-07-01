import { AuthRequiredError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.safelink.queryEvents({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input }) => {
      const db = ctx.db
      const { cursor, limit, urls } = input.body

      const safelinkRuleService = ctx.safelinkRuleService(db)
      const result = await safelinkRuleService.queryEvents({
        cursor,
        limit,
        urls,
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
