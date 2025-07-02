import { Router, raw } from 'express'
import { AppContext } from '../../context'
import { apiAuth, verificationResponseHandler } from './api'
import { AppContextWithAgeAssuranceClient } from './types'
import { webhookAuth, webhookHandler } from './webhook'

export const createRouter = (ctx: AppContext): Router => {
  assertAppContextWithAgeAssuranceClient(ctx)

  const router = Router()
  router.use(raw({ type: 'application/json' }))
  router.post('/age-assurance-webhook', webhookAuth(ctx), webhookHandler(ctx))
  router.get(
    '/age-assurance-verification-response',
    apiAuth(ctx),
    verificationResponseHandler(ctx),
  )
  return router
}

const assertAppContextWithAgeAssuranceClient: (
  ctx: AppContext,
) => asserts ctx is AppContextWithAgeAssuranceClient = (ctx: AppContext) => {
  if (!ctx.ageAssuranceClient) {
    throw new Error(
      'Tried to set up KWS webhook without age assurance client configured.',
    )
  }
}
