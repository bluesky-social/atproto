import express, { RequestHandler } from 'express'
import { AppContext } from '..'
import { RevenueCatClient } from '../purchases'
import { addPurchaseOperation, RcEventBody } from '../purchases'
import { isValidDid } from '../routes/util'
import { httpLogger as log } from '..'

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
      : res.status(403).send({
          success: false,
          error: 'Forbidden: invalid authentication for RevenueCat webhook',
        })

const webhookHandler =
  (ctx: AppContextWithRevenueCatClient): RequestHandler =>
  async (req, res) => {
    const { revenueCatClient } = ctx

    const body: RcEventBody = req.body

    try {
      const { app_user_id: actorDid } = body.event

      if (!isValidDid(actorDid)) {
        return res.status(400).send({
          success: false,
          error: 'Bad request: invalid DID in app_user_id',
        })
      }

      const entitlements =
        await revenueCatClient.getEntitlementIdentifiers(actorDid)

      const id = await addPurchaseOperation(ctx.db, actorDid, entitlements)

      res.send({ success: true, operationId: id })
    } catch (error) {
      log.error(error)

      res.status(500).send({
        success: false,
        error:
          'Internal server error: an error happened while processing the request',
      })
    }
  }

const assertAppContextWithRevenueCatClient: (
  ctx: AppContext,
) => asserts ctx is AppContextWithRevenueCatClient = (ctx: AppContext) => {
  if (!ctx.revenueCatClient) {
    throw new Error(
      'RevenueCat webhook was tried to be set up without configuring a RevenueCat client.',
    )
  }
}

export const createRouter = (ctx: AppContext): express.Router => {
  assertAppContextWithRevenueCatClient(ctx)

  const router = express.Router()
  router.use(auth(ctx))
  router.use(express.json())
  router.post('/', webhookHandler(ctx))
  return router
}
