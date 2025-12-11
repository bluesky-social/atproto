import { Router, raw } from 'express'
import { AppContext } from '../../context'
import { webhookAuth } from '../kws/webhook'
import { handler as ageVerifiedRedirect } from './redirects/kws-age-verified'
import { AppContextWithAA } from './types'
import { handler as ageVerifiedWebhook } from './webhooks/kws-age-verified'

export const createRouter = (ctx: AppContext): Router => {
  assertAppContextWithAgeAssuranceClient(ctx)

  const router = Router()
  router.use(raw({ type: 'application/json' }))
  router.post(
    '/age-assurance/webhooks/kws-age-verified',
    webhookAuth({
      secret: ctx.cfg.kws.ageVerifiedWebhookSecret,
    }),
    ageVerifiedWebhook(ctx),
  )
  router.get(
    '/age-assurance/redirects/kws-age-verified',
    ageVerifiedRedirect(ctx),
  )

  return router
}

const assertAppContextWithAgeAssuranceClient: (
  ctx: AppContext,
) => asserts ctx is AppContextWithAA = (ctx: AppContext) => {
  if (!ctx.kwsClient) {
    throw new Error('Tried to set up KWS router without kwsClient configured.')
  }
}
