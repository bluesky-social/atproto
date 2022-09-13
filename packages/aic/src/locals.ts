import { Database } from './db'
import * as crypto from '@adxp/crypto'
import { Response } from 'express'

export interface Locals {
  db: Database
  keypair: crypto.DidableKey
}

export const get = (res: Response): Locals => {
  if (!res.locals.db) {
    throw new Error('No database provided')
  }
  if (!res.locals.keypair) {
    throw new Error('No keypair provided')
  }
  return {
    db: res.locals.db,
    keypair: res.locals.keypair,
  }
}
