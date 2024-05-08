import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import { User } from '../../lexicon/types/tools/ozone/moderator/defs'
import { getUserRole } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderator.updateUser({
    auth: ctx.authVerifier.moderator,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { did, role, disabled } = input.body

      if (!access.isAdmin) {
        throw new AuthRequiredError(
          'Must be an admin to update a moderator user',
        )
      }
      const moderatorService = ctx.moderatorService(db)

      const userExists = await moderatorService.doesUserExist(did)

      if (!userExists) {
        throw new InvalidRequestError(
          'moderator not found',
          'ModeratorNotFound',
        )
      }

      const newUser = await moderatorService.update(did, {
        disabled,
        role: getUserRole(role),
        lastUpdatedBy: access.iss,
      })

      return {
        encoding: 'application/json',
        body: moderatorService.view(newUser),
      }
    },
  })
}
