import { IpldStore, Repo } from '@bluesky/common'
import { Request, Response } from 'express'
import { Database } from './db/index.js'
import { SERVER_KEYPAIR } from './server-identity.js'
import { ServerError } from './error.js'
import * as ucan from 'ucans'
import { check } from '@bluesky/common'

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

export type Locals = {
  blockstore: IpldStore
  db: Database
}

export const getLocals = (res: Response): Locals => {
  return {
    blockstore: getBlockstore(res),
    db: getDB(res),
  }
}

export const maybeLoadRepo = async (
  res: Response,
  did: string,
  ucanStore?: ucan.Store,
): Promise<Repo | null> => {
  const { db, blockstore } = getLocals(res)
  const currRoot = await db.getRepoRoot(did)
  if (!currRoot) {
    return null
  }
  return Repo.load(blockstore, currRoot, SERVER_KEYPAIR, ucanStore)
}

export const loadRepo = async (
  res: Response,
  did: string,
  ucanStore?: ucan.Store,
): Promise<Repo> => {
  const maybeRepo = await maybeLoadRepo(res, did, ucanStore)
  if (!maybeRepo) {
    throw new ServerError(404, `User has not registered a repo root: ${did}`)
  }
  return maybeRepo
}
