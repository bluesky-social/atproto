import { SpaceUri } from '@atproto/syntax'
import {
  AuthRequiredError,
  InvalidRequestError,
  Server,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.notifyMembership, {
    auth: ctx.authVerifier.serviceAuth,
    handler: async ({ input, auth }) => {
      const { space, did: memberDid, isMember } = input.body

      const spaceDid = new SpaceUri(space).spaceDid
      if (auth.credentials.iss !== spaceDid) {
        throw new AuthRequiredError(
          'JWT issuer must be the space DID',
          'UntrustedIss',
        )
      }
      if (auth.credentials.aud !== memberDid) {
        throw new AuthRequiredError(
          'JWT audience must be the member DID',
          'BadJwtAudience',
        )
      }

      // Verify the member is hosted on this PDS
      const account = await ctx.accountManager.getAccount(memberDid)
      if (!account) {
        throw new InvalidRequestError(
          'Account not found on this PDS',
          'AccountNotFound',
        )
      }

      // Update member's actor store
      await ctx.actorStore.transact(memberDid, async (actorTxn) => {
        if (isMember) {
          const existing = await actorTxn.space.getSpace(space)
          if (!existing) {
            await actorTxn.space.createSpace(space, false)
          }
          await actorTxn.space.updateMembership(space, true)
        } else {
          await actorTxn.space.updateMembership(space, false)
        }
      })
    },
  })
}
