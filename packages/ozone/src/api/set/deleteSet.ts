import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.set.deleteSet({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { name } = input.body

      if (!access.isModerator) {
        throw new AuthRequiredError('Must be a moderator to delete a set')
      }

      const setService = ctx.setService(db)
      const set = await setService.getByName(name)
      if (!set) {
        throw new InvalidRequestError(
          `Set with name "${name}" does not exist`,
          'SetNotFound',
        )
      }

      await setService.removeSet(set.id)

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}
