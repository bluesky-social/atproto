import express, { RequestHandler } from 'express'
import { ageAssuranceLogger as logger } from '../../../logger'
import { AGE_ASSURANCE_CONFIG } from '../const'
import {
  type KWSWebhookAgeVerified,
  parseKWSAgeVerifiedWebhook,
} from '../kws/age-verified'
import { parseKWSExternalPayloadV2 } from '../kws/external-payload'
import { createEvent } from '../stash'
import { type AppContextWithAA } from '../types'
import { computeAgeAssuranceAccessOrThrow } from '../util'

export const handler =
  (ctx: AppContextWithAA): RequestHandler =>
  async (req: express.Request, res: express.Response) => {
    let body: KWSWebhookAgeVerified
    try {
      body = parseKWSAgeVerifiedWebhook(req.body)
    } catch (err) {
      const message = 'Failed to parse KWS webhook body'
      logger.error({ err }, message)
      return res.status(400).json({ error: message })
    }

    const { status, externalPayload } = body.payload
    const { verified, verifiedMinimumAge } = status
    const { actorDid, countryCode, regionCode, attemptId } =
      parseKWSExternalPayloadV2(externalPayload)

    /*
     * KWS does not send unverified webhooks for age verification, so we
     * expect all webhooks to be verified. This is just a sanity check.
     */
    if (!verified) {
      const message = 'Expected KWS webhook to have verified status'
      logger.error({}, message)
      return res.status(400).json({ error: message })
    }

    let result: ReturnType<typeof computeAgeAssuranceAccessOrThrow> | undefined
    try {
      result = computeAgeAssuranceAccessOrThrow(AGE_ASSURANCE_CONFIG, {
        countryCode,
        regionCode,
        verifiedMinimumAge,
      })
    } catch (err) {
      // internal errors
      logger.error(
        { err, attemptId, actorDid, countryCode, regionCode },
        'Failed to compute age assurance access',
      )
    }

    try {
      if (result) {
        await createEvent(ctx, actorDid, {
          attemptId,
          countryCode,
          regionCode,
          status: 'assured',
          access: result.access,
        })
      }

      return res.status(200).end()
    } catch (err) {
      const message = 'Failed to handle KWS webhook'
      logger.error(
        { err, attemptId, actorDid, countryCode, regionCode },
        message,
      )
      return res.status(500).json({ error: message })
    }
  }
