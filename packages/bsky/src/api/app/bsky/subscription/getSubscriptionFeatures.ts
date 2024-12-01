import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { Features } from '../../../../lexicon/types/app/bsky/subscription/getSubscriptionFeatures'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.subscription.getSubscriptionFeatures({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const viewer = auth.credentials.iss

      const features = await getFeaturesForViewerSubscription(viewer, ctx)

      return {
        encoding: 'application/json',
        body: {
          features,
        },
      }
    },
  })
}

const getFeaturesForViewerSubscription = async (
  viewerDid: string,
  ctx: AppContext,
): Promise<Features> => {
  const { subscriptionEntitlements } =
    await ctx.dataplane.getSubscriptionEntitlement({ dids: [viewerDid] })

  const gatedFeatures: Features = {
    customProfileColor: false,
  }

  if (subscriptionEntitlements?.length === 0) {
    return gatedFeatures
  }

  const { entitlements } = subscriptionEntitlements[0]

  return entitlements.reduce((acc, entitlement) => {
    if (!entitlementFeatures[entitlement]) {
      return acc
    }
    return {
      ...acc,
      ...entitlementFeatures[entitlement],
    }
  }, gatedFeatures)
}

type EntitlementFeatures = {
  [entitlementIdentifier: string]: {
    [k: keyof Features]: true
  }
}

const entitlementFeatures: EntitlementFeatures = {
  core: {
    customProfileColor: true,
  },
}
