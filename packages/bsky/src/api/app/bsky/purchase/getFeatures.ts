import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { Features } from '@atproto/api/dist/client/types/app/bsky/purchase/getFeatures'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.purchase.getFeatures({
    auth: ctx.authVerifier.standard,
    handler: async ({ auth }) => {
      const viewer = auth.credentials.iss

      const features = await getFeaturesForViewerEntitlements(viewer, ctx)

      return {
        encoding: 'application/json',
        body: {
          features,
        },
      }
    },
  })
}

const defaultFeatures: Features = {
  customProfileColor: false,
}

const coreEntitlementFeatures: Features = {
  customProfileColor: true,
}

const getFeaturesForViewerEntitlements = async (
  viewerDid: string,
  ctx: AppContext,
): Promise<Features> => {
  const { purchaseEntitlements } = await ctx.dataplane.getPurchaseEntitlements({
    dids: [viewerDid],
  })

  if (purchaseEntitlements?.length === 0) {
    return defaultFeatures
  }

  const { entitlements } = purchaseEntitlements[0]

  if (entitlements.includes('core')) {
    return coreEntitlementFeatures
  } else {
    return defaultFeatures
  }
}
