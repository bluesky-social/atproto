import express, { RequestHandler } from 'express'
import AppContext from '../context'
import { AxiosInstance } from 'axios'
import { httpLogger as log } from '../logger'

type AppContextWithRevenueCatClient = AppContext & {
  revenueCatClient: AxiosInstance
}

const auth =
  (ctx: AppContextWithRevenueCatClient): RequestHandler =>
  (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.header('Authorization') === ctx.cfg.revenueCatWebhookAuthorization
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

type RevenueCatSubscriberResponse = {
  subscriber: {
    entitlements: {
      [entitlementIdentifier: string]: unknown
    }
  }
}

const revenueCatWebhookHandler =
  (ctx: AppContextWithRevenueCatClient): RequestHandler =>
  async (req, res) => {
    const { dataplane, revenueCatClient } = ctx

    const body: RevenueCatEventBody = req.body

    try {
      const { app_user_id: did } = body.event
      const { data } = await revenueCatClient.get(
        `/subscribers/${encodeURIComponent(did)}`,
      )

      const subscriberRes = data as RevenueCatSubscriberResponse
      const entitlementIdentifiers = Object.keys(
        subscriberRes.subscriber.entitlements ?? {},
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
