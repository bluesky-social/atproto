import { Request, Response } from 'express'
import { check } from '@adxp/common'
import log from './logger'

export const handler = (err: Error, _req: Request, res: Response) => {
  let status
  if (ServerError.is(err)) {
    status = err.status
    log.info({ err }, 'server error')
    console.log('Info: ', err.message)
  } else {
    status = 500
    log.error({ err }, 'unknown internal server error')
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
      check.isObject(obj) &&
      typeof obj.message === 'string' &&
      typeof obj.status === 'number'
    )
  }
}
