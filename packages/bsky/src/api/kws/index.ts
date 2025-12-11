import { Router, raw } from 'express'
import { AppContext } from '../../context'
import { verificationHandler } from './api'
import { AppContextWithKwsClient } from './types'
import { webhookAuth, webhookHandler } from './webhook'

export const createRouter = (ctx: AppContext): Router => {
  assertAppContextWithAgeAssuranceClient(ctx)

  const router = Router()
  router.use(raw({ type: 'application/json' }))
  router.post(
    '/age-assurance-webhook',
    webhookAuth({
      secret: ctx.cfg.kws.webhookSecret,
    }),
    webhookHandler(ctx),
  )
  router.get('/age-assurance-verification', verificationHandler(ctx))
  return router
}

const assertAppContextWithAgeAssuranceClient: (
  ctx: AppContext,
) => asserts ctx is AppContextWithKwsClient = (ctx: AppContext) => {
  if (!ctx.kwsClient) {
    throw new Error('Tried to set up KWS router without kwsClient configured.')
  }
}
