import { sql } from 'kysely'
import { DatabaseSchema } from './database-schema'

export const countAll = sql<number>`count(*)`

export const excluded = <T>(db: DatabaseSchema, col: string) => {
  return sql<T>`${db.dynamic.ref(`excluded.${col}`)}`
}
