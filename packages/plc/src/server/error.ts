import { Request, Response, NextFunction } from 'express'

export const handler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
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
    // @TODO would be nice to pull some of this out into an _actual_ `common` package
    return (
      !!obj &&
      typeof obj === 'object' &&
      typeof (obj as Record<string, unknown>).message === 'string' &&
      typeof (obj as Record<string, unknown>).status === 'number'
    )
  }
}
