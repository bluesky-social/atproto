import { AuthRequiredError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderator.deleteUser({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { did } = input.body

      if (!access.isAdmin) {
        throw new AuthRequiredError(
          'Must be an admin to delete a moderator user',
        )
      }
      const moderatorService = ctx.moderatorService(db)

      const canDelete = await moderatorService.canDelete(did)

      if (canDelete) {
        await moderatorService.delete(did)
      }
    },
  })
}
