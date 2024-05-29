import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.team.deleteMember({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { did } = input.body

      if (!access.isAdmin) {
        throw new AuthRequiredError('Must be an admin to delete a member')
      }
      if (did === ctx.cfg.service.did) {
        throw new InvalidRequestError('Can not delete service owner')
      }
      await db.transaction(async (dbTxn) => {
        const teamService = ctx.teamService(dbTxn)
        await teamService.assertCanDelete(did)
        await teamService.delete(did)
      })
    },
  })
}
