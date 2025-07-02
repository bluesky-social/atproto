import express, { RequestHandler } from 'express'
import { httpLogger as log } from '../../logger'
import {
  AgeAssuranceWebhookBody,
  AppContextWithAgeAssuranceClient,
  webhookBodyIntermediateSchema,
} from './types'
import {
  createStashEvent,
  parseExternalPayload,
  validateSignature,
} from './util'

export const webhookAuth =
  (ctx: AppContextWithAgeAssuranceClient): RequestHandler =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body: Buffer = req.body
    const sigHeader = req.headers['x-kws-signature']
    if (!sigHeader || typeof sigHeader !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid signature header',
      })
    }

    try {
      const [t, v1] = sigHeader.split(',')
      const timestamp = t?.split('=')[1]
      const signature = v1?.split('=')[1]
      if (typeof timestamp !== 'string' || typeof signature !== 'string') {
        throw new Error('Invalid webhook signature format')
      }

      const data = `${timestamp}.${body}`
      validateSignature(ctx.cfg.kws.webhookSigningKey, data, signature)
      next()
    } catch (err) {
      log.error({ err }, 'Invalid KWS webhook signature')
      return res.status(403).json({
        success: false,
        error: 'Invalid authentication for KWS webhook',
      })
    }
  }

type AgeAssuranceWebhookIntermediateBody = {
  payload: Omit<AgeAssuranceWebhookBody['payload'], 'externalPayload'> & {
    externalPayload: string
  }
}

const parseBody = (
  ctx: AppContextWithAgeAssuranceClient,
  serialized: string,
): AgeAssuranceWebhookBody => {
  try {
    const value: unknown = JSON.parse(serialized)
    const intermediate: AgeAssuranceWebhookIntermediateBody =
      webhookBodyIntermediateSchema.parse(value)

    return {
      ...intermediate,
      payload: {
        ...intermediate.payload,
        externalPayload: parseExternalPayload(
          intermediate.payload.externalPayload,
        ),
      },
    }
  } catch (err) {
    throw new Error(`Invalid webhook body: ${serialized}`, { cause: err })
  }
}

export const webhookHandler =
  (ctx: AppContextWithAgeAssuranceClient): RequestHandler =>
  async (req: express.Request, res: express.Response) => {
    let body: AgeAssuranceWebhookBody
    try {
      body = parseBody(ctx, req.body)
    } catch (err) {
      log.error({ err }, 'Invalid KWS webhook body')
      return res.status(400).json(err)
    }

    const {
      payload: {
        status: { verified },
        externalPayload,
      },
    } = body
    const { actorDid, attemptId, attemptIp } = externalPayload

    if (!verified) {
      log.warn(
        { actorDid, attemptId, attemptIp },
        'Unexpected KWS webhook call with unverified status',
      )
      return res.status(200).end()
    }

    try {
      await createStashEvent(ctx, externalPayload)
      return res.status(200).end()
    } catch (err) {
      log.error({ err }, 'Failed to handle KWS webhook')
      return res.status(500).json(err)
    }
  }
