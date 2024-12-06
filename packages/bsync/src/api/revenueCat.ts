import express, { RequestHandler } from 'express'
import { AppContext } from '..'
import { rcEventBodySchema, PurchasesClient } from '../purchases'
import { addPurchaseOperation, RcEventBody } from '../purchases'
import { isValidDid } from '../routes/util'
import { httpLogger as log } from '..'

type AppContextWithPurchasesClient = AppContext & {
  purchasesClient: PurchasesClient
}

const auth =
  (ctx: AppContextWithPurchasesClient): RequestHandler =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const validAuthorization =
      ctx.purchasesClient.isRcWebhookAuthorizationValid(
        req.header('Authorization'),
      )

    if (validAuthorization) {
      return next()
    }

    return res.status(403).json({
      success: false,
      error: 'Forbidden: invalid authentication for RevenueCat webhook',
    })
  }

const webhookHandler =
  (ctx: AppContextWithPurchasesClient): RequestHandler =>
  async (req, res) => {
    const { purchasesClient } = ctx

    let body: RcEventBody
    try {
      body = rcEventBodySchema.parse(req.body)
    } catch (error) {
      log.error({ error }, 'RevenueCat webhook body schema validation failed')

      return res.status(400).json({
        success: false,
        error: 'Bad request: body schema validation failed',
      })
    }

    const { app_user_id: actorDid } = body.event

    if (!isValidDid(actorDid)) {
      log.error({ actorDid }, 'RevenueCat webhook got invalid DID')

      return res.status(400).json({
        success: false,
        error: 'Bad request: invalid DID in app_user_id',
      })
    }

    try {
      const entitlements = await purchasesClient.getEntitlements(actorDid)

      const id = await addPurchaseOperation(ctx.db, actorDid, entitlements)

      return res.json({ success: true, operationId: id })
    } catch (error) {
      log.error({ error }, 'Error while processing RevenueCat webhook')

      return res.status(500).json({
        success: false,
        error:
          'Internal server error: an error happened while processing the request',
      })
    }
  }

const assertAppContextWithPurchasesClient: (
  ctx: AppContext,
) => asserts ctx is AppContextWithPurchasesClient = (ctx: AppContext) => {
  if (!ctx.purchasesClient) {
    throw new Error(
      'RevenueCat webhook was tried to be set up without configuring a RevenueCat client.',
    )
  }
}

export const createRouter = (ctx: AppContext): express.Router => {
  assertAppContextWithPurchasesClient(ctx)

  const router = express.Router()
  router.use(auth(ctx))
  router.use(express.json())
  router.post('/', webhookHandler(ctx))
  return router
}
