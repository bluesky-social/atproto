import { Response } from 'express'
import pino from 'pino'
import { App } from '.'
import { Database } from './db'
import { ServerError } from './error'

export interface Locals {
  logger: pino.Logger
  db: Database
  version: string
}

type HasLocals = App | Response

export const get = (res: HasLocals): Locals => {
  if (!res.locals.logger) {
    throw new ServerError(500, 'Could not find attached logger')
  }
  if (!res.locals.db) {
    throw new ServerError(500, 'Could not connect to database')
  }
  if (!res.locals.version) {
    throw new ServerError(500, 'Could not get version')
  }
  return {
    logger: res.locals.logger,
    db: res.locals.db,
    version: res.locals.version,
  }
}
