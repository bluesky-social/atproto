import { Request, Response } from 'express'
import { httpLogger as log } from './logger'

export const handler = (err: Error, _req: Request, res: Response) => {
  log.error({ err }, 'unexpected internal server error')
  res.status(500).send(err.message)
}
