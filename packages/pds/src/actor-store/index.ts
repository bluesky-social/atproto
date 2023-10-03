import { AtpAgent } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import { ActorDb } from './actor-db'
import { BackgroundQueue } from '../background'
import { RecordReader } from './record/reader'
import { LocalReader } from './local/reader'
import { PreferenceReader } from './preference/reader'
import { RepoReader } from './repo/reader'
import { RepoTransactor } from './repo/transactor'
import { PreferenceTransactor } from './preference/preference'

type ActorStoreResources = {
  repoSigningKey: crypto.Keypair
  blobstore: BlobStore
  backgroundQueue: BackgroundQueue
  pdsHostname: string
  appViewAgent?: AtpAgent
  appViewDid?: string
  appViewCdnUrlPattern?: string
}

export const createActorStore = (
  resources: ActorStoreResources,
): ActorStore => {
  return {
    db: (did: string) => {
      return ActorDb.sqlite('', did)
    },
    reader: (did: string) => {
      const db = ActorDb.sqlite('', did)
      return createActorReader(db, resources)
    },
    transact: <T>(did: string, fn: ActorStoreTransactFn<T>) => {
      const db = ActorDb.sqlite('', did)
      return db.transaction((dbTxn) => {
        const store = createActorTransactor(dbTxn, resources)
        return fn(store)
      })
    },
  }
}

const createActorTransactor = (
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
    repo: new RepoTransactor(db, repoSigningKey, blobstore, backgroundQueue),
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
