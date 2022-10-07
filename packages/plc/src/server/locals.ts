import { Response } from 'express'
import pino from 'pino'
import { Database } from './db'
import { ServerError } from './error'

export interface Locals {
  logger: pino.Logger
  db: Database
}

export const get = (res: Response): Locals => {
  if (!res.locals.logger) {
    throw new ServerError(500, 'Could not find attached logger')
  }
  if (!res.locals.db) {
    throw new ServerError(500, 'Could not connect to database')
  }
  return {
    logger: res.locals.logger,
    db: res.locals.db,
  }
}
