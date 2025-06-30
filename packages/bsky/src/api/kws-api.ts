import express, { RequestHandler, Router, raw } from 'express'
import { TID } from '@atproto/common'
import { AgeAssuranceClient } from '../age-assurance'
import { KwsConfig, ServerConfig } from '../config'
import { AppContext } from '../context'
import { AgeAssuranceEvent } from '../lexicon/types/app/bsky/unspecced/defs'
import { Namespaces } from '../stash'

type AppContextWithAgeAssuranceClient = AppContext & {
  ageAssuranceClient: AgeAssuranceClient
  cfg: ServerConfig & {
    kws: KwsConfig
  }
}

export const createRouter = (ctx: AppContext): Router => {
  assertAppContextWithAgeAssuranceClient(ctx)

  const router = Router()
  router.use(raw({ type: 'application/json' }))
  router.use(auth(ctx))
  router.post('/age-assurance-webhook', ageAssuranceWebhookHandler(ctx))
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

const auth =
  (ctx: AppContextWithAgeAssuranceClient): RequestHandler =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body: Buffer = req.body
    const sig = req.headers['x-kws-signature']

    try {
      ctx.ageAssuranceClient.validateWebhookSignature(body, sig)
      return next()
    } catch (err) {
      // @TODO log.
      console.error(err)

      return res.status(403).json({
        success: false,
        error: 'Forbidden: invalid authentication for KWS webhook',
      })
    }
  }

const ageAssuranceWebhookHandler =
  (ctx: AppContextWithAgeAssuranceClient): RequestHandler =>
  async (req: express.Request, res: express.Response) => {
    try {
      const { payload: webhookPayload } =
        ctx.ageAssuranceClient.parseWebhookBody(req.body)

      if (!webhookPayload.status.verified) {
        // @TODO log.
        res.status(200)
        res.json({ ack: 'ack' })
        return
      }

      const stashPayload: AgeAssuranceEvent = {
        timestamp: new Date().toISOString(),
        status: 'assured',
        attemptId: webhookPayload.externalPayload.attemptId,
        attemptIp: webhookPayload.externalPayload.attemptIp,
      }

      await ctx.stashClient.create({
        actorDid: webhookPayload.externalPayload.actorDid,
        namespace: Namespaces.AppBskyUnspeccedDefsAgeAssuranceEvent,
        key: TID.nextStr(),
        payload: stashPayload,
      })

      res.status(200)
      res.json({ ack: 'ack' })
    } catch (err) {
      // @TODO log.
      console.error(err)

      res.status(500)
      res.json(err)
    }
  }
