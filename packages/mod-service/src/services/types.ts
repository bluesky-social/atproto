import { Database, PrimaryDatabase } from '../db'

export type FromDb<T> = (db: Database) => T
export type FromDbPrimary<T> = (db: PrimaryDatabase) => T
