import { IpldStore, UserStore } from '@bluesky-demo/common'
import { Request, Response } from 'express'
import { Database } from './db/types.js'
import * as UserRoots from './db/user-roots.js'
import { SERVER_KEYPAIR } from './server-identity.js'

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

export const getBlockstore = (res: Response): IpldStore => {
  const blockstore = res.locals.blockstore
  if (!blockstore) {
    throw new Error('No Blockstore object attached to server')
  }
  return blockstore as IpldStore
}

export const getDB = (res: Response): Database => {
  const db = res.locals.db
  if (!db) {
    throw new Error('No Database object attached to server')
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

export const loadUserStore = async (
  res: Response,
  did: string,
): Promise<UserStore> => {
  const { db, blockstore } = getLocals(res)
  const currRoot = await UserRoots.get(db, did)
  console.log('CURR ROOT: ', currRoot)
  if (!currRoot) {
    throw new Error(`User has not registered a repo root: ${did}`)
  }
  return UserStore.load(blockstore, currRoot, SERVER_KEYPAIR)
}
