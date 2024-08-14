import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.sets.upsertSet({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { name, description = '' } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError(
          'Must be a moderator to create or update a set',
        )
      }

      if (!name) {
        throw new InvalidRequestError('Name is required')
      }

      const setService = ctx.setService(db)

      const upsertedSet = await setService.upsert({
        name,
        description,
      })

      return {
        encoding: 'application/json',
        body: {
          name: upsertedSet.name,
          description: upsertedSet.description ?? undefined,
        },
      }
    },
  })
}
