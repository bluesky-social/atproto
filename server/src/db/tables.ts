import { Database } from './types'
import * as UserDids from './user-dids.js'
import * as UserRoots from './user-roots.js'

export const create = async (db: Database) => {
  await UserDids.createTable(db)
  await UserRoots.createTable(db)
}

export const dropAll = async (db: Database) => {
  await Promise.all([
    drop(db, UserDids.TABLE_NAME),
    drop(db, UserRoots.TABLE_NAME),
  ])
}

export const drop = async (db: Database, tableName: string) => {
  return db.schema.dropTableIfExists(tableName)
}
