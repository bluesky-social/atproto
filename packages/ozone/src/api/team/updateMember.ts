import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../lexicon'
import AppContext from '../../context'
import { getMemberRole } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.team.updateMember({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { did, role, disabled } = input.body

      if (!access.isAdmin) {
        throw new AuthRequiredError('Must be an admin to update a member')
      }
      const teamService = ctx.teamService(db)

      const userExists = await teamService.doesMemberExist(did)

      if (!userExists) {
        throw new InvalidRequestError('member not found', 'MemberNotFound')
      }

      const updatedMember = await teamService.update(did, {
        disabled,
        role: getMemberRole(role),
        lastUpdatedBy:
          access.type === 'admin_token' ? 'admin_token' : access.iss,
      })

      return {
        encoding: 'application/json',
        body: teamService.view(updatedMember),
      }
    },
  })
}
