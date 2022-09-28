import { Request, Response } from 'express'
import { check } from '@adxp/common'
import { IpldStore, Repo } from '@adxp/repo'
import * as auth from '@adxp/auth'
import * as plc from '@adxp/plc'
import { Database } from './db'
import { ServerError } from './error'
import { ServerConfig } from './config'
import ServerAuth from './auth'

export const readReqBytes = async (req: Request): Promise<Uint8Array> => {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      resolve(new Uint8Array(Buffer.concat(chunks)))
    })
  })
}

export const checkReqBody = <T>(body: unknown, schema: check.Def<T>): T => {
  try {
    return check.assure(schema, body)
  } catch (err) {
    throw new ServerError(400, `Poorly formatted request: ${err}`)
  }
}

export const parseBooleanParam = (
  param: unknown,
  defaultTrue = false,
): boolean => {
  if (defaultTrue) {
    if (param === 'false' || param === 'f') return false
    return true
  } else {
    if (param === 'true' || param === 't') return true
    return false
  }
}

export const getBlockstore = (res: Response): IpldStore => {
  const blockstore = res.locals.blockstore
  if (!blockstore) {
    throw new ServerError(500, 'No Blockstore object attached to server')
  }
  return blockstore as IpldStore
}

export const getDB = (res: Response): Database => {
  const db = res.locals.db
  if (!db) {
    throw new ServerError(500, 'No Database object attached to server')
  }
  return db as Database
}

export const getKeypair = (res: Response): auth.DidableKey => {
  const keypair = res.locals.keypair
  if (!keypair) {
    throw new ServerError(500, 'No Keypair object attached to server')
  }
  return keypair as auth.DidableKey
}

export const getConfig = (res: Response): ServerConfig => {
  const config = res.locals.config
  if (!config) {
    throw new ServerError(500, 'No Config object attached to server')
  }
  return config as ServerConfig
}

export const getAuth = (res: Response): ServerAuth => {
  const auth = res.locals.auth
  if (!auth) {
    throw new ServerError(500, 'No Auth object attached to server')
  }
  return auth as ServerAuth
}

export type Locals = {
  blockstore: IpldStore
  db: Database
  keypair: auth.DidableKey
  auth: ServerAuth
  config: ServerConfig
}

export const getLocals = (res: Response): Locals => {
  return {
    blockstore: getBlockstore(res),
    db: getDB(res),
    keypair: getKeypair(res),
    auth: getAuth(res),
    config: getConfig(res),
  }
}

export const getAuthstore = (res: Response, did: string): auth.AuthStore => {
  const { auth, keypair } = getLocals(res)
  // @TODO check that we can sign on behalf of this DID
  return auth.verifier.loadAuthStore(keypair, [], did)
}

export const getPlcClient = (res: Response): plc.PlcClient => {
  const cfg = getConfig(res)
  return new plc.PlcClient(cfg.didPlcUrl)
}

export const maybeLoadRepo = async (
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

export const loadRepo = async (res: Response, did: string): Promise<Repo> => {
  const maybeRepo = await maybeLoadRepo(res, did)
  if (!maybeRepo) {
    throw new ServerError(404, `User has not registered a repo root: ${did}`)
  }
  return maybeRepo
}

export const getOwnHost = (req: Request): string => {
  const host = req.get('host')
  if (!host) {
    throw new ServerError(500, 'Could not get own host')
  }
  return host
}
