import { InternalServerError } from '@atproto/xrpc-server'
import { ErrorRequestHandler } from 'express'
import { httpLogger as log } from './logger'

export const handler: ErrorRequestHandler = (err, _req, res, next) => {
  log.error(err, 'unexpected internal server error')
  if (res.headersSent) {
    return next(err)
  }
  const internalErr = new InternalServerError()
  res.status(internalErr.type).json(internalErr.payload)
}
