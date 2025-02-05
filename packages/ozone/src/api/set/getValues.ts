import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.set.getValues({
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
        throw new InvalidRequestError(
          `Set with name "${name}" not found`,
          'SetNotFound',
        )
      }

      return {
        encoding: 'application/json',
        body: {
          set: setService.view(result.set),
          values: result.values,
          cursor: result.cursor,
        },
      }
    },
  })
}
