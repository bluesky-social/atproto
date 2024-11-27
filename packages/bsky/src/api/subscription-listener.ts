import express, { RequestHandler } from 'express'
import AppContext from '../context'
import { AxiosInstance } from 'axios'
import { httpLogger as log } from '../logger'

const auth =
  (expectedAuthorization: string | undefined): RequestHandler =>
  (req: express.Request, res: express.Response, next: express.NextFunction) =>
    req.header('Authorization') === expectedAuthorization
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
  (revenueCatClient: AxiosInstance): RequestHandler =>
  async (req, res) => {
    const body: RevenueCatEventBody = req.body

    try {
      const { app_user_id: did } = body.event
      const rcRes = await revenueCatClient.get(
        `/subscribers/${encodeURIComponent(did)}`,
      )

      // @TODO: cache subscription data
      console.log(rcRes.data)
      res.end()
    } catch (error) {
      log.error(error)
      throw error
    }
  }

export const createRouter = (ctx: AppContext): express.Router => {
  const {
    cfg: { revenueCatWebhookAuthorization },
    revenueCatClient,
  } = ctx

  const router = express.Router()

  if (!revenueCatClient) {
    return router
  }

  router.use(auth(revenueCatWebhookAuthorization))
  router.use(express.json())
  router.post('/', revenueCatWebhookHandler(revenueCatClient))

  return router
}
