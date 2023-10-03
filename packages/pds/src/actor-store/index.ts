import { AtpAgent } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import { ActorDb } from './actor-db'
import { ActorRepo } from './repo'
import { ActorRecord } from './record'
import { ActorLocal } from './local'
import { ActorPreference } from './preference'
import { BackgroundQueue } from '../background'

type ActorStoreReaderResources = {
  repoSigningKey: crypto.Keypair
  pdsHostname: string
  appViewAgent?: AtpAgent
  appViewDid?: string
  appViewCdnUrlPattern?: string
}

type ActorStoreResources = ActorStoreReaderResources & {
  blobstore: BlobStore
  backgroundQueue: BackgroundQueue
}

export const createActorStore = (
  resources: ActorStoreResources,
): ActorStore => {
  return {
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
  const { repoSigningKey, blobstore, backgroundQueue } = resources
  const reader = createActorReader(db, resources)
  return {
    ...reader,
    repo: new ActorRepo(db, repoSigningKey, blobstore, backgroundQueue),
  }
}

const createActorReader = (
  db: ActorDb,
  resources: ActorStoreReaderResources,
): ActorStoreReader => {
  const {
    repoSigningKey,
    pdsHostname,
    appViewAgent,
    appViewDid,
    appViewCdnUrlPattern,
  } = resources
  return {
    record: new ActorRecord(db),
    local: new ActorLocal(
      db,
      repoSigningKey,
      pdsHostname,
      appViewAgent,
      appViewDid,
      appViewCdnUrlPattern,
    ),
    pref: new ActorPreference(db),
  }
}

export type ActorStore = {
  reader: (did: string) => ActorStoreReader
  transact: <T>(did: string, store: ActorStoreTransactFn<T>) => Promise<T>
}

export type ActorStoreTransactFn<T> = (fn: ActorStoreTransactor) => Promise<T>

export type ActorStoreTransactor = ActorStoreReader & {
  repo: ActorRepo
}

export type ActorStoreReader = {
  record: ActorRecord
  local: ActorLocal
  pref: ActorPreference
}
