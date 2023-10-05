import path from 'path'
import { AtpAgent } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import { rmIfExists } from '@atproto/common'
import { ActorDb, getMigrator } from './db'
import { BackgroundQueue } from '../background'
import { RecordReader } from './record/reader'
import { LocalReader } from './local/reader'
import { PreferenceReader } from './preference/reader'
import { RepoReader } from './repo/reader'
import { RepoTransactor } from './repo/transactor'
import { PreferenceTransactor } from './preference/preference'
import { Database } from '../db'

type ActorStoreResources = {
  repoSigningKey: crypto.Keypair
  blobstore: BlobStore
  backgroundQueue: BackgroundQueue
  dbDirectory: string
  pdsHostname: string
  appViewAgent?: AtpAgent
  appViewDid?: string
  appViewCdnUrlPattern?: string
}

export const createActorStore = (
  resources: ActorStoreResources,
): ActorStore => {
  const getAndMigrateDb = async (did: string): Promise<ActorDb> => {
    const location = path.join(resources.dbDirectory, did)
    const db: ActorDb = Database.sqlite(location)
    const migrator = getMigrator(db)
    await migrator.migrateToLatestOrThrow()
    return db
  }

  return {
    db: getAndMigrateDb,
    read: async <T>(did: string, fn: ActorStoreReadFn<T>) => {
      const db = await getAndMigrateDb(did)
      const reader = createActorReader(did, db, resources)
      const result = await fn(reader)
      await db.close()
      return result
    },
    transact: async <T>(did: string, fn: ActorStoreTransactFn<T>) => {
      const db = await getAndMigrateDb(did)
      const result = await db.transaction((dbTxn) => {
        const store = createActorTransactor(did, dbTxn, resources)
        return fn(store)
      })
      await db.close()
      return result
    },
    destroy: async (did: string) => {
      await rmIfExists(path.join(resources.dbDirectory, did))
      await rmIfExists(path.join(resources.dbDirectory, `${did}-wal`))
      await rmIfExists(path.join(resources.dbDirectory, `${did}-shm`))
    },
  }
}

const createActorTransactor = (
  did: string,
  db: ActorDb,
  resources: ActorStoreResources,
): ActorStoreTransactor => {
  const {
    repoSigningKey,
    blobstore,
    backgroundQueue,
    pdsHostname,
    appViewAgent,
    appViewDid,
    appViewCdnUrlPattern,
  } = resources
  return {
    db,
    repo: new RepoTransactor(
      db,
      did,
      repoSigningKey,
      blobstore,
      backgroundQueue,
    ),
    record: new RecordReader(db),
    local: new LocalReader(
      db,
      repoSigningKey,
      pdsHostname,
      appViewAgent,
      appViewDid,
      appViewCdnUrlPattern,
    ),
    pref: new PreferenceTransactor(db),
  }
}

const createActorReader = (
  did: string,
  db: ActorDb,
  resources: ActorStoreResources,
): ActorStoreReader => {
  const {
    repoSigningKey,
    blobstore,
    pdsHostname,
    appViewAgent,
    appViewDid,
    appViewCdnUrlPattern,
  } = resources
  return {
    db,
    repo: new RepoReader(db, blobstore),
    record: new RecordReader(db),
    local: new LocalReader(
      db,
      repoSigningKey,
      pdsHostname,
      appViewAgent,
      appViewDid,
      appViewCdnUrlPattern,
    ),
    pref: new PreferenceReader(db),
    transact: async <T>(fn: ActorStoreTransactFn<T>): Promise<T> => {
      return db.transaction((dbTxn) => {
        const store = createActorTransactor(did, dbTxn, resources)
        return fn(store)
      })
    },
  }
}

export type ActorStore = {
  db: (did: string) => Promise<ActorDb>
  read: <T>(did: string, fn: ActorStoreReadFn<T>) => Promise<T>
  transact: <T>(did: string, fn: ActorStoreTransactFn<T>) => Promise<T>
  destroy: (did: string) => Promise<void>
}

export type ActorStoreReadFn<T> = (fn: ActorStoreReader) => Promise<T>
export type ActorStoreTransactFn<T> = (fn: ActorStoreTransactor) => Promise<T>

export type ActorStoreReader = {
  db: ActorDb
  repo: RepoReader
  record: RecordReader
  local: LocalReader
  pref: PreferenceReader
  transact: <T>(fn: ActorStoreTransactFn<T>) => Promise<T>
}

export type ActorStoreTransactor = {
  db: ActorDb
  repo: RepoTransactor
  record: RecordReader
  local: LocalReader
  pref: PreferenceTransactor
}
