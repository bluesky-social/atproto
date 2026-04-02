import { RepoRecord } from '../types'

export interface SpaceStorage {
  // Record CRUD
  getRecord(collection: string, rkey: string): Promise<RepoRecord | null>
  putRecord(collection: string, rkey: string, record: RepoRecord): Promise<void>
  deleteRecord(collection: string, rkey: string): Promise<boolean>
  hasRecord(collection: string, rkey: string): Promise<boolean>

  // Enumeration
  listCollections(): Promise<string[]>
  listRecords(
    collection: string,
  ): Promise<{ rkey: string; record: RepoRecord }[]>

  // Set hash
  getSetHash(): Promise<Buffer | null>
  putSetHash(hash: Buffer): Promise<void>

  // Lifecycle
  destroy(): Promise<void>
}
