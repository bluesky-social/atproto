import { Database } from './types.js'

export const TABLE_NAME = 'user_dids'

export const createTable = async (db: Database) => {
  return db.schema.createTable(TABLE_NAME, (table) => {
    table.string('did').unique()
    table.string('username').unique()
  })
}

export const register = async (
  db: Database,
  username: string,
  did: string,
): Promise<void> => {
  await db.insert({ username, did }).into(TABLE_NAME)
}

export const get = async (
  db: Database,
  username: string,
): Promise<string | null> => {
  const row = await db
    .select('did')
    .from(TABLE_NAME)
    .where('username', username)
  if (row.length < 1) return null
  return row[0].did
}
