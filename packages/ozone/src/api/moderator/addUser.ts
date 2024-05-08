import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import { getUserRole } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderator.addUser({
    auth: ctx.authVerifier.moderator,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { did, role } = input.body

      if (!access.isAdmin) {
        throw new AuthRequiredError('Must be an admin to add a moderator user')
      }
      const moderatorService = ctx.moderatorService(db)

      const alreadyExists = await moderatorService.doesUserExist(did)

      if (alreadyExists) {
        throw new InvalidRequestError(
          'moderator already exists',
          'ModeratorAlreadyExists',
        )
      }

      const newUser = await moderatorService.create({
        did,
        disabled: false,
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
