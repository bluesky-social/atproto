import { Response } from 'express'
import { Database } from './db'
import { ServerError } from './error'

export interface Locals {
  db: Database
}

export const get = (res: Response): Locals => {
  if (!res.locals.db) {
    throw new ServerError(500, 'Could not connect to database')
  }
  return {
    db: res.locals.db,
  }
}
