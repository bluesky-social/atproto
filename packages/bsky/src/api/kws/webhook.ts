import express, { RequestHandler } from 'express'
import { httpLogger as log } from '../../logger'
import { AGE_ASSURANCE_CONFIG } from '../age-assurance/const'
import {
  KWSExternalPayloadVersion,
  parseKWSExternalPayloadV1WithV2Compat,
} from '../age-assurance/kws/external-payload'
import { createEvent } from '../age-assurance/stash'
import { computeAgeAssuranceAccessOrThrow } from '../age-assurance/util'
import {
  AppContextWithKwsClient,
  KwsWebhookBody,
  webhookBodyIntermediateSchema,
} from './types'
import { createStashEvent, kwsWwwAuthenticate, validateSignature } from './util'

export const webhookAuth =
  ({ secret }: { secret: string }): RequestHandler =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body: Buffer = req.body
    const sigHeader = req.headers['x-kws-signature']
    if (!sigHeader || typeof sigHeader !== 'string') {
      return res.status(401).header(kwsWwwAuthenticate()).json({
        success: false,
        error:
          'Invalid authentication for KWS webhook: missing signature header',
      })
    }

    try {
      const parts = sigHeader.split(',')
      const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1]
      const signature = parts.find((p) => p.startsWith('v1='))?.split('=')[1]
      if (typeof timestamp !== 'string' || typeof signature !== 'string') {
        throw new Error('Invalid webhook signature format')
      }

      const data = `${timestamp}.${body}`
      validateSignature(secret, data, signature)
      next()
    } catch (err) {
      log.error({ err }, 'Invalid KWS webhook signature')
      return res.status(401).header(kwsWwwAuthenticate()).json({
        success: false,
        error: 'Invalid authentication for KWS webhook: signature mismatch',
      })
    }
  }

type AgeAssuranceWebhookIntermediateBody = {
  payload: Omit<KwsWebhookBody['payload'], 'externalPayload'> & {
    externalPayload: string
  }
}

const parseBody = (serialized: string): AgeAssuranceWebhookIntermediateBody => {
  try {
    const value: unknown = JSON.parse(serialized)
    return webhookBodyIntermediateSchema.parse(value)
  } catch (err) {
    throw new Error(`Invalid webhook body: ${serialized}`, { cause: err })
  }
}

export const webhookHandler =
  (ctx: AppContextWithKwsClient): RequestHandler =>
  async (req: express.Request, res: express.Response) => {
    let body: AgeAssuranceWebhookIntermediateBody
    try {
      body = parseBody(req.body)
    } catch (err) {
      log.error({ err }, 'Invalid KWS webhook body')
      return res.status(400).json(err)
    }

    const { verified } = body.payload.status
    if (!verified) {
      throw new Error('Unexpected KWS webhook call with unverified status')
    }

    const externalPayload = parseKWSExternalPayloadV1WithV2Compat(
      body.payload.externalPayload,
    )
    const isV2 = externalPayload.version === KWSExternalPayloadVersion.V2

    let result: ReturnType<typeof computeAgeAssuranceAccessOrThrow> | undefined
    if (isV2) {
      const { attemptId, actorDid, countryCode, regionCode } = externalPayload
      try {
        result = computeAgeAssuranceAccessOrThrow(AGE_ASSURANCE_CONFIG, {
          countryCode: countryCode,
          regionCode: regionCode,
          verifiedMinimumAge: 18, // `adult-verified` is 18+ only
        })
      } catch (err) {
        // internal errors
        log.error(
          { err, attemptId, actorDid, countryCode, regionCode },
          'Failed to compute age assurance access',
        )
      }
    }

    try {
      if (isV2) {
        if (result) {
          const { attemptId, actorDid, countryCode, regionCode } =
            externalPayload
          await createEvent(ctx, actorDid, {
            attemptId,
            status: 'assured',
            access: result.access,
            countryCode,
            regionCode,
          })
        } // else do nothing
      } else {
        const { attemptId, actorDid } = externalPayload
        await createStashEvent(ctx, {
          attemptId: attemptId,
          actorDid: actorDid,
          status: 'assured',
        })
      }
      return res.status(200).end()
    } catch (err) {
      log.error({ err }, 'Failed to handle KWS webhook')
      return res.status(500).json(err)
    }
  }
