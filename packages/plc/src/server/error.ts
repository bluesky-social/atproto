import { Request, Response, NextFunction } from 'express'
import * as locals from './locals'

export const handler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const { logger } = locals.get(res)
  let status
  if (ServerError.is(err)) {
    status = err.status
    logger.info(err, 'handled server error')
  } else {
    status = 500
    logger.error(err, 'unexpected internal server error')
  }
  res.status(status).send(err.message)
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
