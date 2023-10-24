import path from 'path'
import fs from 'fs/promises'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import { fileExists, isErrnoException, rmIfExists, wait } from '@atproto/common'
import { ActorDb, getMigrator } from './db'
import { BackgroundQueue } from '../background'
import { RecordReader } from './record/reader'
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
  dbDirectory: string
  blobstore: (did: string) => BlobStore
  backgroundQueue: BackgroundQueue
}

export class ActorStore {
  cache: LRUCache<string, ActorDb>

  constructor(public resources: ActorStoreResources) {
    this.cache = new LRUCache<string, ActorDb>({
      max: 2000,
      dispose: async (db) => {
        await db.close()
      },
      fetchMethod: async (key, _staleValue, { signal }) => {
        const loaded = await this.loadDbFile(key)
        // if fetch is aborted then another handler opened the db first
        // so we can close this handle and return `undefined`
        if (signal.aborted) {
          await loaded.close()
          return undefined
        }
        return loaded
      },
    })
  }

  private async getDbLocation(did: string) {
    const didHash = await crypto.sha256Hex(did)
    const subdir = path.join(this.resources.dbDirectory, didHash.slice(0, 2))
    const location = path.join(subdir, `${did}.sqlite`)
    return { subdir, location }
  }

  private async loadDbFile(
    did: string,
    shouldCreate = false,
  ): Promise<ActorDb> {
    const { subdir, location } = await this.getDbLocation(did)
    const exists = await fileExists(location)
    if (!exists) {
      if (shouldCreate) {
        await mkdir(subdir, { recursive: true })
      } else {
        throw new InvalidRequestError('Repo not found', 'NotFound')
      }
    }
    return Database.sqlite(location)
  }

  private async createAndMigrateDb(did: string): Promise<ActorDb> {
    const db = await this.loadDbFile(did, true)
    const migrator = getMigrator(db)
    await migrator.migrateToLatestOrThrow()
    return db
  }

  private async storeKeypair(did: string, keypair: crypto.ExportableKeypair) {
    const { subdir } = await this.getDbLocation(did)
    const privKey = await keypair.export()
    await fs.writeFile(path.join(subdir, `${did}.key`), privKey)
    return keypair
  }

  async keypair(did: string): Promise<crypto.Keypair> {
    const { subdir } = await this.getDbLocation(did)
    const privKey = await fs.readFile(path.join(subdir, `${did}.key`))
    return crypto.Secp256k1Keypair.import(privKey)
  }

  async db(did: string): Promise<ActorDb> {
    const got = await this.cache.fetch(did)
    if (!got) {
      throw new InvalidRequestError('Repo not found', 'NotFound')
    }
    return got
  }

  async reader(did: string) {
    const [db, keypair] = await Promise.all([this.db(did), this.keypair(did)])
    return createActorReader(did, db, keypair, this.resources)
  }

  async read<T>(did: string, fn: ActorStoreReadFn<T>) {
    const reader = await this.reader(did)
    return fn(reader)
  }

  async transact<T>(did: string, fn: ActorStoreTransactFn<T>) {
    const [db, keypair] = await Promise.all([this.db(did), this.keypair(did)])
    const result = await transactAndRetryOnLock(
      did,
      db,
      keypair,
      this.resources,
      fn,
    )
    return result
  }

  async create<T>(
    did: string,
    keypair: crypto.ExportableKeypair,
    fn: ActorStoreTransactFn<T>,
  ) {
    const db = await this.createAndMigrateDb(did)
    await this.storeKeypair(did, keypair)
    const result = await db.transaction((dbTxn) => {
      const store = createActorTransactor(did, dbTxn, keypair, this.resources)
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

    const { location } = await this.getDbLocation(did)
    await rmIfExists(location)
    await rmIfExists(`${location}-wal`)
    await rmIfExists(`${location}-shm`)
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
  keypair: crypto.Keypair,
  resources: ActorStoreResources,
  fn: ActorStoreTransactFn<T>,
  retryNumber = 0,
) => {
  try {
    return await db.transaction((dbTxn) => {
      const store = createActorTransactor(did, dbTxn, keypair, resources)
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
      return transactAndRetryOnLock(
        did,
        db,
        keypair,
        resources,
        fn,
        retryNumber + 1,
      )
    }
    throw err
  }
}

const createActorTransactor = (
  did: string,
  db: ActorDb,
  keypair: crypto.Keypair,
  resources: ActorStoreResources,
): ActorStoreTransactor => {
  const { blobstore, backgroundQueue } = resources
  const userBlobstore = blobstore(did)
  return {
    db,
    repo: new RepoTransactor(db, did, keypair, userBlobstore, backgroundQueue),
    record: new RecordTransactor(db, userBlobstore),
    pref: new PreferenceTransactor(db),
  }
}

const createActorReader = (
  did: string,
  db: ActorDb,
  keypair: crypto.Keypair,
  resources: ActorStoreResources,
): ActorStoreReader => {
  const { blobstore } = resources
  return {
    db,
    repo: new RepoReader(db, blobstore(did)),
    record: new RecordReader(db),
    pref: new PreferenceReader(db),
    transact: async <T>(fn: ActorStoreTransactFn<T>): Promise<T> => {
      return transactAndRetryOnLock(did, db, keypair, resources, fn)
    },
  }
}

export type ActorStoreReadFn<T> = (fn: ActorStoreReader) => Promise<T>
export type ActorStoreTransactFn<T> = (fn: ActorStoreTransactor) => Promise<T>

export type ActorStoreReader = {
  db: ActorDb
  repo: RepoReader
  record: RecordReader
  pref: PreferenceReader
  transact: <T>(fn: ActorStoreTransactFn<T>) => Promise<T>
}

export type ActorStoreTransactor = {
  db: ActorDb
  repo: RepoTransactor
  record: RecordTransactor
  pref: PreferenceTransactor
}
