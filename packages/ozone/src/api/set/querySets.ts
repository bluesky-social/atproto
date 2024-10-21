import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.set.querySets({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { limit, cursor, namePrefix, sortBy, sortDirection } = params

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to query sets')
      }

      const setService = ctx.setService(db)

      const queryResult = await setService.query({
        limit,
        cursor,
        namePrefix,
        sortBy,
        sortDirection,
      })

      return {
        encoding: 'application/json',
        body: {
          sets: queryResult.sets.map((set) => setService.view(set)),
          cursor: queryResult.cursor,
        },
      }
    },
  })
}
