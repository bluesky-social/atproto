import path from 'path'
import fs from 'fs/promises'
import * as crypto from '@atproto/crypto'
import { Keypair, ExportableKeypair } from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import { chunkArray, fileExists, rmIfExists } from '@atproto/common'
import { ActorDb, getDb, getMigrator } from './db'
import { BackgroundQueue } from '../background'
import { RecordReader } from './record/reader'
import { PreferenceReader } from './preference/reader'
import { RepoReader } from './repo/reader'
import { RepoTransactor } from './repo/transactor'
import { PreferenceTransactor } from './preference/transactor'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { RecordTransactor } from './record/transactor'
import { CID } from 'multiformats/cid'
import { LRUCache } from 'lru-cache'
import DiskBlobStore from '../disk-blobstore'
import { mkdir } from 'fs/promises'
import { ActorStoreConfig } from '../config'

type ActorStoreResources = {
  blobstore: (did: string) => BlobStore
  backgroundQueue: BackgroundQueue
}

export class ActorStore {
  dbCache: LRUCache<string, ActorDb>
  keyCache: LRUCache<string, Keypair>

  constructor(
    public cfg: ActorStoreConfig,
    public resources: ActorStoreResources,
  ) {
    this.dbCache = new LRUCache<string, ActorDb>({
      max: cfg.cacheSize,
      dispose: async (db) => {
        await db.close()
      },
      fetchMethod: async (did, _staleValue, { signal }) => {
        const { dbLocation } = await this.getLocation(did)
        const exists = await fileExists(dbLocation)
        if (!exists) {
          throw new InvalidRequestError('Repo not found', 'NotFound')
        }

        // if fetch is aborted then another handler opened the db first
        // so we can close this handle and return `undefined`
        return signal.aborted ? undefined : getDb(dbLocation)
      },
    })
    this.keyCache = new LRUCache<string, Keypair>({
      max: cfg.cacheSize,
      fetchMethod: async (did) => {
        const { keyLocation } = await this.getLocation(did)
        const privKey = await fs.readFile(keyLocation)
        return crypto.Secp256k1Keypair.import(privKey)
      },
    })
  }

  async getLocation(did: string) {
    const didHash = await crypto.sha256Hex(did)
    const directory = path.join(this.cfg.directory, didHash.slice(0, 2), did)
    const dbLocation = path.join(directory, `store.sqlite`)
    const keyLocation = path.join(directory, `key`)
    return { directory, dbLocation, keyLocation }
  }

  async keypair(did: string): Promise<Keypair> {
    const got = await this.keyCache.fetch(did)
    if (!got) {
      throw new InvalidRequestError('Keypair not found', 'NotFound')
    }
    return got
  }

  async db(did: string): Promise<ActorDb> {
    const got = await this.dbCache.fetch(did)
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
    return db.transaction((dbTxn) => {
      const store = createActorTransactor(did, dbTxn, keypair, this.resources)
      return fn(store)
    })
  }

  async create<T>(
    did: string,
    keypair: ExportableKeypair,
    fn: ActorStoreTransactFn<T>,
  ) {
    const { directory, dbLocation, keyLocation } = await this.getLocation(did)
    // ensure subdir exists
    await mkdir(directory, { recursive: true })
    const exists = await fileExists(dbLocation)
    if (exists) {
      throw new InvalidRequestError('Repo already exists', 'AlreadyExists')
    }
    const privKey = await keypair.export()
    await fs.writeFile(keyLocation, privKey)

    const db: ActorDb = getDb(dbLocation)
    try {
      const migrator = getMigrator(db)
      await migrator.migrateToLatestOrThrow()

      const result = await db.transaction((dbTxn) => {
        const store = createActorTransactor(did, dbTxn, keypair, this.resources)
        return fn(store)
      })
      this.dbCache.set(did, db)
      return result
    } catch (err) {
      await db.close()
      throw err
    }
  }

  async destroy(did: string) {
    const blobstore = this.resources.blobstore(did)
    if (blobstore instanceof DiskBlobStore) {
      await blobstore.deleteAll()
    } else {
      const db = await this.db(did)
      const blobRows = await db.db.selectFrom('blob').select('cid').execute()
      const cids = blobRows.map((row) => CID.parse(row.cid))
      await Promise.allSettled(
        chunkArray(cids, 500).map((chunk) => blobstore.deleteMany(chunk)),
      )
    }

    const got = this.dbCache.get(did)
    this.dbCache.delete(did)
    this.keyCache.delete(did)
    if (got) {
      await got.close()
    }

    const { directory } = await this.getLocation(did)
    await rmIfExists(directory, true)
  }

  async close() {
    const promises: Promise<void>[] = []
    for (const key of this.dbCache.keys()) {
      const got = this.dbCache.get(key)
      this.dbCache.delete(key)
      if (got) {
        promises.push(got.close())
      }
    }
    await Promise.allSettled(promises)
    this.keyCache.clear()
  }
}

const createActorTransactor = (
  did: string,
  db: ActorDb,
  keypair: Keypair,
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
  keypair: Keypair,
  resources: ActorStoreResources,
): ActorStoreReader => {
  const { blobstore } = resources
  return {
    db,
    repo: new RepoReader(db, blobstore(did)),
    record: new RecordReader(db),
    pref: new PreferenceReader(db),
    transact: async <T>(fn: ActorStoreTransactFn<T>): Promise<T> => {
      return db.transaction((dbTxn) => {
        const store = createActorTransactor(did, dbTxn, keypair, resources)
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
  pref: PreferenceReader
  transact: <T>(fn: ActorStoreTransactFn<T>) => Promise<T>
}

export type ActorStoreTransactor = {
  db: ActorDb
  repo: RepoTransactor
  record: RecordTransactor
  pref: PreferenceTransactor
}
