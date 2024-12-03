import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { AuthRequiredError, UpstreamFailureError } from '@atproto/xrpc-server'
import { entitlementIdentifiersFromSubscriber } from '../../../../subscriptions'
import { RoleOutput, StandardOutput } from '../../../../auth-verifier'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.subscription.refreshSubscriptionCache({
    auth: ctx.authVerifier.standardOrRole,
    handler: async ({ auth, input }) => {
      const { did } = input.body
      validateCredentials(did, auth)

      if (!ctx.revenueCatClient) {
        throw new UpstreamFailureError(
          'subscription service is not available',
          'UnavailableSubscriptionService',
        )
      }

      const subscriberRes = await ctx.revenueCatClient.getSubscriber(did)

      const entitlementIdentifiers = entitlementIdentifiersFromSubscriber(
        subscriberRes.subscriber,
      )

      await ctx.dataplane.setSubscriptionEntitlement({
        did,
        entitlements: entitlementIdentifiers,
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
