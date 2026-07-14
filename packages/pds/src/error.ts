import type { ErrorRequestHandler } from 'express'
import { OAuthError } from '@atproto/oauth-provider/errors'
import { XRPCError } from '@atproto/xrpc-server'
import { httpLogger as log } from './logger.js'

export const handler: ErrorRequestHandler = (err, _req, res, next) => {
  log.error({ err }, 'unexpected internal server error')
  if (res.headersSent) {
    return next(err)
  }

  if (err instanceof OAuthError) {
    res.status(err.status).json(err.toJSON())
    return
  }

  const serverError = XRPCError.fromError(err)
  res.status(serverError.type).json(serverError.payload)
}
