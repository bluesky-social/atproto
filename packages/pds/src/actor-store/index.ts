import path from 'path'
import { AtpAgent } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import { fileExists, isErrnoException, rmIfExists, wait } from '@atproto/common'
import { ActorDb, getMigrator } from './db'
import { BackgroundQueue } from '../background'
import { RecordReader } from './record/reader'
import { LocalReader } from './local/reader'
import { PreferenceReader } from './preference/reader'
import { RepoReader } from './repo/reader'
import { RepoTransactor } from './repo/transactor'
import { PreferenceTransactor } from './preference/preference'
import { Database } from '../db'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { RecordTransactor } from './record/transactor'
import { CID } from 'multiformats/cid'
import { LRUCache } from 'lru-cache'
import DiskBlobStore from '../disk-blobstore'
import { mkdir } from 'fs/promises'

type ActorStoreResources = {
  repoSigningKey: crypto.Keypair
  blobstore: (did: string) => BlobStore
  backgroundQueue: BackgroundQueue
  dbDirectory: string
  pdsHostname: string
  appViewAgent?: AtpAgent
  appViewDid?: string
  appViewCdnUrlPattern?: string
}

export class ActorStore {
  cache: LRUCache<string, ActorDb>

  constructor(public resources: ActorStoreResources) {
    this.cache = new LRUCache<string, ActorDb>({
      max: 2000,
      dispose: async (db) => {
        await db.close()
      },
    })
  }

  private async getDbLocation(did: string) {
    const { location } = await this.getDbPartitionAndLocation(did)
    return location
  }

  private async getDbPartitionAndLocation(did: string) {
    const didHash = await crypto.sha256Hex(did)
    const partition = path.join(this.resources.dbDirectory, didHash.slice(0, 2))
    const location = path.join(partition, didHash.slice(2))
    return { partition, location }
  }

  private async loadDbFile(
    did: string,
    shouldCreate = false,
  ): Promise<ActorDb> {
    const { partition, location } = await this.getDbPartitionAndLocation(did)
    const exists = await fileExists(location)
    if (!exists) {
      if (shouldCreate) {
        await mkdir(partition, { recursive: true })
      } else {
        throw new InvalidRequestError('Repo not found', 'NotFound')
      }
    }
    return Database.sqlite(location)
  }

  async db(did: string): Promise<ActorDb> {
    let got = this.cache.get(did)
    if (!got) {
      got = await this.loadDbFile(did)
      this.cache.set(did, got)
    }
    return got
  }

  async reader(did: string) {
    const db = await this.db(did)
    return createActorReader(did, db, this.resources)
  }

  async read<T>(did: string, fn: ActorStoreReadFn<T>) {
    const reader = await this.reader(did)
    return fn(reader)
  }

  async transact<T>(did: string, fn: ActorStoreTransactFn<T>) {
    const db = await this.db(did)
    const result = await transactAndRetryOnLock(did, db, this.resources, fn)
    return result
  }

  async create<T>(did: string, fn: ActorStoreTransactFn<T>) {
    const db = await this.loadDbFile(did, true)
    const migrator = getMigrator(db)
    await migrator.migrateToLatestOrThrow()
    const result = await db.transaction((dbTxn) => {
      const store = createActorTransactor(did, dbTxn, this.resources)
      return fn(store)
    })
    this.cache.set(did, db)
    return result
  }

  async destroy(did: string) {
    const blobstore = this.resources.blobstore(did)
    if (blobstore instanceof DiskBlobStore) {
      await blobstore.deleteAll()
    } else {
      const db = await this.db(did)
      const blobRows = await db.db.selectFrom('blob').select('cid').execute()
      const cids = blobRows.map((row) => CID.parse(row.cid))
      await Promise.allSettled(cids.map((cid) => blobstore.delete(cid)))
    }

    const got = this.cache.get(did)
    this.cache.delete(did)
    if (got) {
      await got.close()
    }

    const dbLocation = await this.getDbLocation(did)
    await rmIfExists(dbLocation)
    await rmIfExists(`${dbLocation}-wal`)
    await rmIfExists(`${dbLocation}-shm`)
  }

  async close() {
    const promises: Promise<void>[] = []
    for (const key of this.cache.keys()) {
      const got = this.cache.get(key)
      this.cache.delete(key)
      if (got) {
        promises.push(got.close())
      }
    }
    await Promise.all(promises)
  }
}

const transactAndRetryOnLock = async <T>(
  did: string,
  db: ActorDb,
  resources: ActorStoreResources,
  fn: ActorStoreTransactFn<T>,
  retryNumber = 0,
) => {
  try {
    return await db.transaction((dbTxn) => {
      const store = createActorTransactor(did, dbTxn, resources)
      return fn(store)
    })
  } catch (err) {
    if (isErrnoException(err) && err.code === 'SQLITE_BUSY') {
      if (retryNumber > 10) {
        throw new InvalidRequestError(
          'Too many concurrent writes',
          'ConcurrentWrite',
        )
      }
      await wait(Math.pow(2, retryNumber))
      return transactAndRetryOnLock(did, db, resources, fn, retryNumber + 1)
    }
    throw err
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
  const userBlobstore = blobstore(did)
  return {
    db,
    repo: new RepoTransactor(
      db,
      did,
      repoSigningKey,
      userBlobstore,
      backgroundQueue,
    ),
    record: new RecordTransactor(db, userBlobstore),
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
    repo: new RepoReader(db, blobstore(did)),
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
  record: RecordTransactor
  local: LocalReader
  pref: PreferenceTransactor
}
