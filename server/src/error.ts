import { Request, Response } from 'express'
import { check } from '@adx/common'

export const handler = (err: Error, _req: Request, res: Response) => {
  console.log('HERE')
  console.log(err)

  let status
  if (ServerError.is(err)) {
    status = err.status
    console.log('Info: ', err.message)
  } else {
    status = 500
    console.log('Error: ', err.message)
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
