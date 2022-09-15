import { Database } from './db'
import { Response } from 'express'

export interface Locals {
  db: Database
}

export const get = (res: Response): Locals => {
  if (!res.locals.db) {
    throw new Error('No database provided')
  }
  return {
    db: res.locals.db,
  }
}
