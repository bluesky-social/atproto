import { ErrorRequestHandler } from 'express'
import { XRPCError } from '@atproto/xrpc-server'
import { httpLogger as log } from './logger'

export const handler: ErrorRequestHandler = (err, _req, res, next) => {
  log.error(err, 'unexpected internal server error')
  if (res.headersSent) {
    return next(err)
  }
  const serverError = XRPCError.fromError(err)
  res.status(serverError.type).json(serverError.payload)
}
