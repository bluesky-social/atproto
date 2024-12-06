import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AuthRequiredError } from '@atproto/xrpc-server'
import { RoleOutput, StandardOutput } from '../../../../auth-verifier'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.purchase.refreshCache({
    auth: ctx.authVerifier.standardOrRole,
    handler: async ({ auth, input }) => {
      const { did } = input.body
      validateCredentials(did, auth)

      await ctx.bsyncClient.addPurchaseOperation({
        actorDid: did,
      })

      return {
        encoding: 'application/json',
        body: {},
      }
    },
  })
}

const validateCredentials = (
  did: string,
  auth: StandardOutput | RoleOutput,
) => {
  // admins can refresh any user's subscription cache
  if (auth.credentials.type === 'role') {
    return
  }

  // users can only refresh their own subscription cache
  if (auth.credentials.iss !== did) {
    throw new AuthRequiredError('bad issuer')
  }
}
