import { Response } from 'express'
import pino from 'pino'
import { IpldStore, Repo } from '@atproto/repo'
import { AuthStore, DidableKey } from '@atproto/auth'
import * as plc from '@atproto/plc'
import { Database } from './db'
import { ServerConfig } from './config'
import ServerAuth from './auth'
import { ServerMailer } from './mailer'
import { App } from '.'

export type Locals = {
  logger: pino.Logger
  blockstore: IpldStore
  db: Database
  keypair: DidableKey
  auth: ServerAuth
  config: ServerConfig
  mailer: ServerMailer
}

type HasLocals = App | Response

export const logger = (res: HasLocals): pino.Logger => {
  const logger = res.locals.logger
  if (!logger) {
    throw new Error('No Logger object attached to server')
  }
  return logger as pino.Logger
}

export const blockstore = (res: HasLocals): IpldStore => {
  const blockstore = res.locals.blockstore
  if (!blockstore) {
    throw new Error('No Blockstore object attached to server')
  }
  return blockstore as IpldStore
}

export const db = (res: HasLocals): Database => {
  const db = res.locals.db
  if (!db) {
    throw new Error('No Database object attached to server')
  }
  return db as Database
}

export const keypair = (res: HasLocals): DidableKey => {
  const keypair = res.locals.keypair
  if (!keypair) {
    throw new Error('No Keypair object attached to server')
  }
  return keypair as DidableKey
}

export const config = (res: HasLocals): ServerConfig => {
  const config = res.locals.config
  if (!config) {
    throw new Error('No Config object attached to server')
  }
  return config as ServerConfig
}

export const mailer = (res: HasLocals): ServerMailer => {
  const mailer = res.locals.mailer
  if (!mailer) {
    throw new Error('No Mailer object attached to server')
  }
  return mailer as ServerMailer
}

export const auth = (res: HasLocals): ServerAuth => {
  const auth = res.locals.auth
  if (!auth) {
    throw new Error('No Auth object attached to server')
  }
  return auth as ServerAuth
}

export const getLocals = (res: HasLocals): Locals => {
  return {
    logger: logger(res),
    blockstore: blockstore(res),
    db: db(res),
    keypair: keypair(res),
    auth: auth(res),
    config: config(res),
    mailer: mailer(res),
  }
}
export const get = getLocals

export const plcClient = (res: Response): plc.PlcClient => {
  const cfg = config(res)
  return new plc.PlcClient(cfg.didPlcUrl)
}

export const getAuthstore = (res: Response, did: string): AuthStore => {
  const { auth, keypair } = get(res)
  // @TODO check that we can sign on behalf of this DID
  return auth.verifier.loadAuthStore(keypair, [], did)
}

export const loadRepo = async (
  res: Response,
  did: string,
): Promise<Repo | null> => {
  const { db, blockstore, auth } = getLocals(res)
  const currRoot = await db.getRepoRoot(did)
  if (!currRoot) {
    return null
  }
  const authStore = getAuthstore(res, did)
  return Repo.load(blockstore, currRoot, auth.verifier, authStore)
}
