import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.set.deleteValues({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { name, values } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError(
          'Must be a moderator to remove values from a set',
        )
      }

      const setService = ctx.setService(db)
      const set = await setService.getByName(name)
      if (!set) {
        throw new InvalidRequestError(
          `Set with name "${name}" does not exist`,
          'SetNotFound',
        )
      }

      await setService.removeValues(set.id, values)
    },
  })
}
