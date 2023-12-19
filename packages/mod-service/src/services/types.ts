import { Database } from '../db'

export type FromDb<T> = (db: Database) => T
