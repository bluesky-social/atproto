import { Request, Response } from 'express'
import { logger } from './logger'

export const handler = (err: Error, _req: Request, res: Response) => {
  logger.error({ err }, 'unexpected internal server error')
  res.status(500).send(err.message)
}
