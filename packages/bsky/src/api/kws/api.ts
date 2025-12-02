import express, { RequestHandler } from 'express'
import { httpLogger as log } from '../../logger'
import { AGE_ASSURANCE_CONFIG } from '../age-assurance/const'
import {
  KWSExternalPayloadVersion,
  parseKWSExternalPayloadV1WithV2Compat,
} from '../age-assurance/kws/external-payload'
import { createEvent } from '../age-assurance/stash'
import { computeAgeAssuranceAccessOrThrow } from '../age-assurance/util'
import { AppContextWithKwsClient } from './types'
import {
  createStashEvent,
  getClientUa,
  parseStatus,
  validateSignature,
} from './util'

function parseQueryParams(
  ctx: AppContextWithKwsClient,
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
      ctx.cfg.kws.verificationSecret,
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

export const verificationHandler =
  (ctx: AppContextWithKwsClient): RequestHandler =>
  async (req: express.Request, res: express.Response) => {
    let actorDid: string | undefined
    try {
      const query = parseQueryParams(ctx, req)
      const { verified } = parseStatus(query.status)
      if (!verified) {
        throw new Error(
          'Unexpected KWS verification response call with unverified status',
        )
      }

      // Assumes `app.set('trust proxy', ...)` configured with `true` or specific values.
      const completeIp = req.ip
      const completeUa = getClientUa(req)
      const externalPayload = parseKWSExternalPayloadV1WithV2Compat(
        query.externalPayload,
      )
      actorDid = externalPayload.actorDid

      if (externalPayload.version === KWSExternalPayloadVersion.V2) {
        const { countryCode, regionCode, attemptId } = externalPayload
        const { access } = computeAgeAssuranceAccessOrThrow(
          AGE_ASSURANCE_CONFIG,
          {
            countryCode: countryCode,
            regionCode: regionCode,
            verifiedMinimumAge: 18, // `adult-verified` is 18+ only
          },
        )
        await createEvent(ctx, actorDid, {
          attemptId,
          status: 'assured',
          access,
          countryCode,
          regionCode,
          completeIp,
          completeUa,
        })
      } else {
        await createStashEvent(ctx, {
          actorDid,
          attemptId: externalPayload.attemptId,
          status: 'assured',
          completeIp,
          completeUa,
        })
      }

      return res
        .status(302)
        .setHeader(
          'Location',
          `${ctx.cfg.kws.redirectUrl}?${new URLSearchParams({ actorDid, result: 'success' })}`,
        )
        .end()
    } catch (err) {
      log.error({ err }, 'Failed to handle KWS verification response')

      return res
        .status(302)
        .setHeader(
          'Location',
          `${ctx.cfg.kws.redirectUrl}?${new URLSearchParams({ ...(actorDid ? { actorDid } : {}), result: 'unknown' })}`,
        )
        .end()
    }
  }
