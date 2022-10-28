import { ErrorRequestHandler } from 'express'
import * as locals from './locals'

export const handler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { logger } = locals.get(res)
  if (ServerError.is(err)) {
    logger.info(err, 'handled server error')
    return res.status(err.status).json({ message: err.message })
  } else {
    logger.error(err, 'unexpected internal server error')
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
