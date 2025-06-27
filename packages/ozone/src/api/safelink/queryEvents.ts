import { AuthRequiredError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.safelink.queryEvents({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { cursor, limit, urls } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError(
          'Must be a moderator to query URL safety events',
        )
      }

      const safelinkService = ctx.safelinkService(db)
      const result = await safelinkService.queryEvents({
        cursor,
        limit,
        urls,
      })

      return {
        encoding: 'application/json',
        body: {
          cursor: result.cursor,
          events: result.events.map((event) =>
            safelinkService.formatEvent(event),
          ),
        },
      }
    },
  })
}
