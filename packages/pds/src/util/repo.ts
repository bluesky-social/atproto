import { CID } from 'multiformats/cid'
import { CidWriteOp, IpldStore } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import Database from '../db'
import SqlBlockstore from '../sql-blockstore'

export type MutationContext = {
  db: Database
  blockstore: IpldStore
  did: string
  time: string
}

export const mutationContext = (
  db: Database,
  did: string,
  time?: string,
): MutationContext => {
  time = time || new Date().toISOString()
  return {
    db,
    blockstore: new SqlBlockstore(db, did, time),
    did,
    time,
  }
}

export type PreparedUpdate = {
  uri: AtUri
  cid: CID
  toStage: CidWriteOp
  dbUpdate: Promise<void>
}

export const prepareCreate = async (
  ctx: MutationContext,
  collection: string,
  rkey: string,
  record: Record<string, unknown>,
): Promise<PreparedUpdate> => {
  record.$type = collection
  const cid = await ctx.blockstore.put(record)
  const uri = AtUri.make(ctx.did, collection, rkey)
  return {
    uri,
    cid,
    toStage: {
      action: 'create',
      collection,
      rkey,
      cid,
    },
    dbUpdate: ctx.db.indexRecord(uri, cid, record, ctx.time),
  }
}
