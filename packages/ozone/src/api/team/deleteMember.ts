import {
  AuthRequiredError,
  InvalidRequestError,
  type Server,
} from '@atproto/xrpc-server'
import type { AppContext } from '../../context.js'
import { tools } from '../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(tools.ozone.team.deleteMember, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { did } = input.body

      if (!access.isAdmin) {
        throw new AuthRequiredError('Must be an admin to delete a member')
      }
      if ('did' in auth.credentials && did === auth.credentials.did) {
        throw new InvalidRequestError(
          'You can not delete yourself from the team',
          'CannotDeleteSelf',
        )
      }
      await db.transaction(async (dbTxn) => {
        const teamService = ctx.teamService(dbTxn)
        await teamService.assertCanDelete(did)
        await teamService.delete(did)
      })
    },
  })
}
