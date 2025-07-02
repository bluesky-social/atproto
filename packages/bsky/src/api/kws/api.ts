import qs from 'node:querystring'
import express, { RequestHandler } from 'express'
import { httpLogger as log } from '../../logger'
import {
  AgeAssuranceApiQuery,
  AppContextWithAgeAssuranceClient,
  apiQueryIntermediateSchema,
} from './types'
import {
  createStashEvent,
  parseExternalPayload,
  parseStatus,
  validateSignature,
} from './util'

export const apiAuth =
  (ctx: AppContextWithAgeAssuranceClient): RequestHandler =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { status: assuranceStatus, externalPayload, signature } = req.query
    if (
      !assuranceStatus ||
      !externalPayload ||
      !signature ||
      typeof assuranceStatus !== 'string' ||
      typeof externalPayload !== 'string' ||
      typeof signature !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid query parameters',
      })
    }

    try {
      const data = `${assuranceStatus}:${externalPayload}`
      validateSignature(ctx.cfg.kws.signingKey, data, signature)
      next()
    } catch (err) {
      log.error({ err }, 'Invalid KWS API signature')
      return res.status(403).json({
        success: false,
        error: 'Invalid authentication for KWS API',
      })
    }
  }

type AgeAssuranceApiIntermediateQuery = {
  externalPayload: string
  status: string
  signature: string
}

const parseQuery = (
  ctx: AppContextWithAgeAssuranceClient,
  externalPayload: express.Request['query'][string],
  signature: express.Request['query'][string],
  status: express.Request['query'][string],
): AgeAssuranceApiQuery => {
  try {
    const intermediate: AgeAssuranceApiIntermediateQuery =
      apiQueryIntermediateSchema.parse({
        externalPayload,
        signature,
        status,
      })

    return {
      ...intermediate,
      externalPayload: parseExternalPayload(intermediate.externalPayload),
      status: parseStatus(intermediate.status),
    }
  } catch (err) {
    throw new Error(
      `Invalid API params: ${{ externalPayload, signature, status }}`,
      { cause: err },
    )
  }
}

export const verificationResponseHandler =
  (ctx: AppContextWithAgeAssuranceClient): RequestHandler =>
  async (req: express.Request, res: express.Response) => {
    const { externalPayload, signature, status } = req.query

    const query = parseQuery(ctx, externalPayload, signature, status)

    try {
      const { externalPayload, status } = query
      const { actorDid, attemptId, attemptIp } = externalPayload

      if (!status.verified) {
        log.warn(
          { actorDid, attemptId, attemptIp },
          'Unexpected KWS verification response call with unverified status',
        )
        return res
          .status(302)
          .setHeader(
            'Location',
            `${ctx.cfg.kws.redirectUrl}?${qs.stringify({ success: false })}`,
          )
          .end()
      }

      await createStashEvent(ctx, externalPayload)
      return res
        .status(302)
        .setHeader(
          'Location',
          `${ctx.cfg.kws.redirectUrl}?${qs.stringify({ success: true })}`,
        )
        .end()
    } catch (err) {
      log.error({ err }, 'Failed to handle KWS verification response')
      return res
        .status(302)
        .setHeader(
          'Location',
          `${ctx.cfg.kws.redirectUrl}?${qs.stringify({ success: false })}`,
        )
        .end()
    }
  }
