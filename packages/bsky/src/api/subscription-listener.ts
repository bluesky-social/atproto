import express, { RequestHandler } from 'express'
import AppContext from '../context'
import { httpLogger as log } from '../logger'
import { RevenueCatClient } from '../subscriptions'
import { entitlementIdentifiersFromSubscriber } from '../subscriptions/util'

type AppContextWithRevenueCatClient = AppContext & {
  revenueCatClient: RevenueCatClient
}

const auth =
  (ctx: AppContextWithRevenueCatClient): RequestHandler =>
  (req: express.Request, res: express.Response, next: express.NextFunction) =>
    ctx.revenueCatClient.isWebhookAuthorizationValid(
      req.header('Authorization'),
    )
      ? next()
      : res
          .status(403)
          .send('Forbidden: invalid authentication for RevenuCat webhook')

// Reference: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields#events-format
type RevenueCatEventBody = {
  api_version: '1.0'
  event: {
    app_user_id: string
    type: string
  }
}

const revenueCatWebhookHandler =
  (ctx: AppContextWithRevenueCatClient): RequestHandler =>
  async (req, res) => {
    const { dataplane, revenueCatClient } = ctx

    const body: RevenueCatEventBody = req.body

    try {
      const { app_user_id: did } = body.event
      const subscriberRes = await revenueCatClient.getSubscriber(did)

      const entitlementIdentifiers = entitlementIdentifiersFromSubscriber(
        subscriberRes.subscriber,
      )

      await dataplane.setSubscriptionEntitlement({
        subscriptionEntitlement: { did, entitlements: entitlementIdentifiers },
      })

      res.end()
    } catch (error) {
      log.error(error)
      throw error
    }
  }

export const createRouter = (ctx: AppContext): express.Router => {
  const router = express.Router()

  if (!ctx.revenueCatClient) {
    return router
  }
  const ctxWithRevenueCatClient = ctx as AppContextWithRevenueCatClient

  router.use(auth(ctxWithRevenueCatClient))
  router.use(express.json())
  router.post('/', revenueCatWebhookHandler(ctxWithRevenueCatClient))

  return router
}
