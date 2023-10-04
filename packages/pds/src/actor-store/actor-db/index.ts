import { DatabaseSchema } from './schema'
import { Database } from '../../db'
export * from './schema'

export type ActorDb = Database<DatabaseSchema>
