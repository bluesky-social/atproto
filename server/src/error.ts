import { NextFunction, Request, Response } from 'express'
import { check } from '@adx/common'

export const handler = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log(err.toString())
  const status = ServerError.is(err) ? err.status : 500
  res.status(status).send(err.message)
  next(err)
}

export class ServerError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }

  static is(obj: unknown): obj is ServerError {
    return (
      check.isObject(obj) &&
      typeof obj.message === 'string' &&
      typeof obj.status === 'number'
    )
  }
}
