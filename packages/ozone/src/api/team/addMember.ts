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
        throw new AuthRequiredError('Must be an admin to add a member')
      }

      const newMember = await db.transaction(async (dbTxn) => {
        const teamService = ctx.teamService(dbTxn)
        const alreadyExists = await teamService.doesMemberExist(did)

        if (alreadyExists) {
          throw new InvalidRequestError(
            'member already exists',
            'MemberAlreadyExists',
          )
        }

        const member = await teamService.create({
          did,
          disabled: false,
          role: getMemberRole(role),
          lastUpdatedBy:
            access.type === 'admin_token' ? 'admin_token' : access.iss,
        })
        const memberView = await teamService.view([member], ctx)
        return memberView[0]
      })

      return {
        encoding: 'application/json',
        body: newMember,
      }
    },
  })
}
