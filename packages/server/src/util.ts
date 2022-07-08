import { Request, Response } from 'express'
import { IpldStore, Repo, check } from '@adxp/common'
import * as auth from '@adxp/auth'
import { Database } from './db'
import { ServerError } from './error'

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

export const checkReqBody = <T>(body: unknown, schema: check.Schema<T>): T => {
  try {
    return check.assure(schema, body)
  } catch (err) {
    throw new ServerError(400, `Poorly formatted request: ${err}`)
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

export type Locals = {
  blockstore: IpldStore
  db: Database
  keypair: auth.DidableKey
}

export const getLocals = (res: Response): Locals => {
  return {
    blockstore: getBlockstore(res),
    db: getDB(res),
    keypair: getKeypair(res),
  }
}

export const maybeLoadRepo = async (
  res: Response,
  did: string,
  authStore?: auth.AuthStore,
): Promise<Repo | null> => {
  const { db, blockstore } = getLocals(res)
  const currRoot = await db.getRepoRoot(did)
  if (!currRoot) {
    return null
  }
  return Repo.load(blockstore, currRoot, authStore)
}

export const loadRepo = async (
  res: Response,
  did: string,
  authStore?: auth.AuthStore,
): Promise<Repo> => {
  const maybeRepo = await maybeLoadRepo(res, did, authStore)
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
