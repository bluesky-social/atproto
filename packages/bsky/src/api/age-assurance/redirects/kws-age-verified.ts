import express, { RequestHandler } from 'express'
import { ageAssuranceLogger as logger } from '../../../logger'
import { getClientUa, validateSignature } from '../../kws/util'
import { AGE_ASSURANCE_CONFIG } from '../const'
import { parseKWSAgeVerifiedStatus } from '../kws/age-verified'
import {
  type KWSExternalPayloadV2,
  parseKWSExternalPayloadV2,
} from '../kws/external-payload'
import { createEvent } from '../stash'
import { AppContextWithAA } from '../types'
import { computeAgeAssuranceAccessOrThrow } from '../util'

function parseQueryParams(
  ctx: AppContextWithAA,
  req: express.Request,
): {
  status: string
  externalPayload: string
} {
  try {
    const status = String(req.query.status)
    const externalPayload = String(req.query.externalPayload)
    const signature = String(req.query.signature)

    validateSignature(
      ctx.cfg.kws.ageVerifiedRedirectSecret,
      `${status}:${externalPayload}`,
      signature,
    )

    return {
      status,
      externalPayload,
    }
  } catch (err) {
    throw new Error('Invalid KWS API request', { cause: err })
  }
}

export const handler =
  (ctx: AppContextWithAA): RequestHandler =>
  async (req: express.Request, res: express.Response) => {
    let externalPayload: KWSExternalPayloadV2 | undefined

    try {
      const query = parseQueryParams(ctx, req)
      const { verified, verifiedMinimumAge } = parseKWSAgeVerifiedStatus(
        query.status,
      )
      externalPayload = parseKWSExternalPayloadV2(query.externalPayload)
      const { actorDid, attemptId, countryCode, regionCode } = externalPayload

      /*
       * KWS does not send unverified webhooks for age verification, so we
       * expect all webhooks to be verified. This is just a sanity check.
       */
      if (!verified) {
        const message =
          'Expected KWS verification redirect to have verified status'
        logger.error({}, message)
        throw new Error(message)
      }

      const { access } = computeAgeAssuranceAccessOrThrow(
        AGE_ASSURANCE_CONFIG,
        {
          countryCode,
          regionCode,
          verifiedMinimumAge,
        },
      )

      await createEvent(ctx, actorDid, {
        attemptId,
        // Assumes `app.set('trust proxy', ...)` configured with `true` or specific values.
        completeIp: req.ip,
        completeUa: getClientUa(req),
        countryCode,
        regionCode,
        status: 'assured',
        access,
      })

      const q = new URLSearchParams({ actorDid, result: 'success' })

      return res
        .status(302)
        .setHeader('Location', `${ctx.cfg.kws.redirectUrl}?${q}`)
        .end()
    } catch (err) {
      logger.error(
        { err, ...externalPayload },
        'Failed to handle KWS verification redirect',
      )

      const q = new URLSearchParams({
        ...(externalPayload ? { actorDid: externalPayload.actorDid } : {}),
        result: 'unknown',
      })

      return res
        .status(302)
        .setHeader('Location', `${ctx.cfg.kws.redirectUrl}?${q}`)
        .end()
    }
  }
