import { CID } from 'multiformats'
import { Database } from './types.js'

export const TABLE_NAME = 'user_roots'

export const createTable = async (db: Database) => {
  return db.schema.createTable(TABLE_NAME, (table) => {
    table.string('did').unique()
    table.string('root')
  })
}

export const add = async (
  db: Database,
  did: string,
  cid: CID,
): Promise<void> => {
  await db.insert({ did, root: cid.toString() }).into(TABLE_NAME)
}

export const update = async (
  db: Database,
  did: string,
  cid: CID,
): Promise<void> => {
  await db(TABLE_NAME).where({ did }).update({ root: cid.toString() })
}

export const get = async (db: Database, did: string): Promise<CID | null> => {
  const row = await db.select('root').from(TABLE_NAME).where('did', did)
  return row.length < 1 ? null : CID.parse(row[0].root)
}
