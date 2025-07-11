import express, { RequestHandler } from 'express'
import { httpLogger as log } from '../../logger'
import {
  AppContextWithKwsClient,
  KwsVerificationIntermediateQuery,
  KwsVerificationQuery,
  verificationIntermediateQuerySchema,
} from './types'
import {
  createStashEvent,
  getClientUa,
  parseExternalPayload,
  parseStatus,
  validateSignature,
} from './util'

const validateRequest = (
  ctx: AppContextWithKwsClient,
  req: express.Request,
): KwsVerificationQuery => {
  try {
    const intermediate: KwsVerificationIntermediateQuery =
      verificationIntermediateQuerySchema.parse({
        externalPayload: req.query.externalPayload,
        signature: req.query.signature,
        status: req.query.status,
      })

    const data = `${intermediate.status}:${intermediate.externalPayload}`
    validateSignature(
      ctx.cfg.kws.verificationSecret,
      data,
      intermediate.signature,
    )

    return {
      ...intermediate,
      externalPayload: parseExternalPayload(intermediate.externalPayload),
      status: parseStatus(intermediate.status),
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
      const query = validateRequest(ctx, req)
      const {
        externalPayload,
        status: { verified },
      } = query
      if (!verified) {
        throw new Error(
          'Unexpected KWS verification response call with unverified status',
        )
      }

      const { actorDid: externalPayloadActorDid, attemptId } = externalPayload
      actorDid = externalPayloadActorDid
      // Assumes `app.set('trust proxy', ...)` configured with `true` or specific values.
      const completeIp = req.ip
      const completeUa = getClientUa(req)
      await createStashEvent(ctx, {
        actorDid,
        attemptId,
        completeIp,
        completeUa,
        status: 'assured',
      })
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
