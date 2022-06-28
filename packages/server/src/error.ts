import { Request, Response } from 'express'
import { check } from '@adxp/common'

export const handler = (_req: Request, res: Response, next: () => void) => {
  console.log(typeof _req, typeof res, typeof next)
  console.log(_req)
  // const status = 500
  // if (ServerError.is(err)) {
  //   status = err.status
  //   console.log('Info: ', err.message)
  // } else {
  //   status = 500
  //   console.log('Error: ', err.message)
  // }
  res.sendStatus(500)
  next()
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
