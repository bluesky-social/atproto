import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.sets.get({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ params, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { name, limit, cursor } = params

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to get set details')
      }

      const setService = ctx.setService(db)

      const result = await setService.getSetWithValues({
        name,
        limit,
        cursor,
      })

      if (!result) {
        throw new InvalidRequestError(`Set with name "${name}" not found`)
      }

      return {
        encoding: 'application/json',
        body: {
          set: {
            name: result.set.name,
            description: result.set.description ?? undefined,
          },
          values: result.values,
          cursor: result.cursor,
        },
      }
    },
  })
}
