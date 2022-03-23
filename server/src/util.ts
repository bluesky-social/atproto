import { IpldStore } from '@bluesky-demo/common'
import { Request, Response } from 'express'
import { Database } from './db/types'

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
