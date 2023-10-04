import path from 'path'
import { AtpAgent } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import { ActorDb, getMigrator } from './actor-db'
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
  const dbCreator = (did: string): ActorDb => {
    const location = path.join(resources.dbDirectory, did)
    return Database.sqlite(location)
  }

  return {
    db: dbCreator,
    reader: (did: string) => {
      const db = dbCreator(did)
      return createActorReader(db, resources)
    },
    transact: <T>(did: string, fn: ActorStoreTransactFn<T>) => {
      const db = dbCreator(did)
      return db.transaction((dbTxn) => {
        const store = createActorTransactor(did, dbTxn, resources)
        return fn(store)
      })
    },
    create: async (did: string) => {
      const db = dbCreator(did)
      const migrator = getMigrator(db)
      await migrator.migrateToLatestOrThrow()
    },
    destroy: async (did: string) => {
      // @TODO
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
  }
}

export type ActorStore = {
  db: (did: string) => ActorDb
  reader: (did: string) => ActorStoreReader
  transact: <T>(did: string, store: ActorStoreTransactFn<T>) => Promise<T>
  create: (did: string) => Promise<void>
  destroy: (did: string) => Promise<void>
}

export type ActorStoreTransactFn<T> = (fn: ActorStoreTransactor) => Promise<T>

export type ActorStoreTransactor = {
  db: ActorDb
  repo: RepoTransactor
  record: RecordReader
  local: LocalReader
  pref: PreferenceTransactor
}

export type ActorStoreReader = {
  db: ActorDb
  repo: RepoReader
  record: RecordReader
  local: LocalReader
  pref: PreferenceReader
}
