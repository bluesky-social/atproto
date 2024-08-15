import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.set.upsertSet({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { name, description } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError(
          'Must be a moderator to create or update a set',
        )
      }

      const setService = ctx.setService(db)

      await setService.upsert({
        name,
        description: description ?? null,
      })
      const setWithSize = await setService.getByNameWithSize(name)

      // Unlikely to happen since we just upserted the set
      if (!setWithSize) {
        throw new InvalidRequestError(`Set not found`)
      }

      return {
        encoding: 'application/json',
        body: setService.view(setWithSize),
      }
    },
  })
}
