import { AuthRequiredError, InvalidRequestError } from '@atproto/xrpc-server'
import { AppContext } from '../../context'
import { Server } from '../../lexicon'
import { getMemberRole } from '../util'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.team.updateMember({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async ({ input, auth }) => {
      const access = auth.credentials
      const db = ctx.db
      const { did, role, ...rest } = input.body

      if (!access.isAdmin) {
        throw new AuthRequiredError('Must be an admin to update a member')
      }

      if (did === ctx.cfg.service.did) {
        throw new InvalidRequestError('Can not update service owner')
      }

      const updatedMember = await db.transaction(async (dbTxn) => {
        const teamService = ctx.teamService(dbTxn)

        const memberExists = await teamService.doesMemberExist(did)

        if (!memberExists) {
          throw new InvalidRequestError('member not found', 'MemberNotFound')
        }

        const updated = await teamService.update(did, {
          ...rest,
          ...(role ? { role: getMemberRole(role) } : {}),
          lastUpdatedBy:
            access.type === 'admin_token' ? 'admin_token' : access.iss,
        })
        const memberView = await teamService.view([updated])
        return memberView[0]
      })

      return {
        encoding: 'application/json',
        body: updatedMember,
      }
    },
  })
}
