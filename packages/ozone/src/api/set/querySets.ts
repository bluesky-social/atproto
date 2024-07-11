import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.sets.querySets({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { limit = 50, cursor, namePrefix, sortBy = 'name' } = params

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to query sets')
      }

      const setService = ctx.setService(db)

      const queryResult = await setService.query({
        limit,
        cursor,
        namePrefix,
        sortBy,
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
