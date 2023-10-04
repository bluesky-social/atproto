import { Database } from '../db'
import { DatabaseSchema } from './schema'

export * from './schema'

export type ServiceDb = Database<DatabaseSchema>
