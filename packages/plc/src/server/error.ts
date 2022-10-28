import { ErrorRequestHandler } from 'express'
import * as locals from './locals'

export const handler: ErrorRequestHandler = (err, _req, res, next) => {
  const { logger } = locals.get(res)
  logger.info(
    err,
    ServerError.is(err)
      ? 'handled server error'
      : 'unexpected internal server error',
  )
  if (res.headersSent) {
    return next(err)
  }
  if (ServerError.is(err)) {
    return res.status(err.status).json({ message: err.message })
  } else {
    return res.status(500).json({ message: 'Internal Server Error' })
  }
}

export class ServerError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }

  static is(obj: unknown): obj is ServerError {
    return (
      !!obj &&
      typeof obj === 'object' &&
      typeof (obj as Record<string, unknown>).message === 'string' &&
      typeof (obj as Record<string, unknown>).status === 'number'
    )
  }
}
