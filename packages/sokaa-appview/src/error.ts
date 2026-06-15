import { ErrorRequestHandler } from 'express'
import { XRPCError } from '@atproto/xrpc-server'
import { httpLogger as log } from './logger'

export const handler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }
  const serverError = XRPCError.fromError(err)
  if (serverError.type >= 500) {
    log.error({ err }, 'unexpected internal server error')
  } else {
    log.info({ err, status: serverError.type }, 'xrpc client error')
  }
  res.status(serverError.type).json(serverError.payload)
}
