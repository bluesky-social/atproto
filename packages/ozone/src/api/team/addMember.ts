import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import { getMemberRole } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.team.addMember({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { did, role } = input.body

      if (!access.isAdmin) {
        throw new AuthRequiredError('Must be an admin to add a moderator user')
      }
      const teamService = ctx.teamService(db)

      const alreadyExists = await teamService.doesMemberExist(did)

      if (alreadyExists) {
        throw new InvalidRequestError(
          'moderator already exists',
          'MemberAlreadyExists',
        )
      }

      const newMember = await teamService.create({
        did,
        disabled: false,
        role: getMemberRole(role),
        lastUpdatedBy:
          access.type === 'admin_token' ? 'admin_token' : access.iss,
      })

      return {
        encoding: 'application/json',
        body: teamService.view(newMember),
      }
    },
  })
}
