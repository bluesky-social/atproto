import path from 'path'
import assert from 'assert'
import fs from 'fs/promises'
import * as crypto from '@atproto/crypto'
import { Keypair, ExportableKeypair } from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import {
  chunkArray,
  fileExists,
  readIfExists,
  rmIfExists,
} from '@atproto/common'
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
import DiskBlobStore from '../disk-blobstore'
import { mkdir } from 'fs/promises'
import { ActorStoreConfig } from '../config'
import { retrySqlite } from '../db'

type ActorStoreResources = {
  blobstore: (did: string) => BlobStore
  backgroundQueue: BackgroundQueue
  reservedKeyDir?: string
}

export class ActorStore {
  reservedKeyDir: string

  constructor(
    public cfg: ActorStoreConfig,
    public resources: ActorStoreResources,
  ) {
    this.reservedKeyDir = path.join(cfg.directory, 'reserved_keys')
  }

  async getLocation(did: string) {
    const didHash = await crypto.sha256Hex(did)
    const directory = path.join(this.cfg.directory, didHash.slice(0, 2), did)
    const dbLocation = path.join(directory, `store.sqlite`)
    const keyLocation = path.join(directory, `key`)
    return { directory, dbLocation, keyLocation }
  }

  async exists(did: string): Promise<boolean> {
    const location = await this.getLocation(did)
    return await fileExists(location.dbLocation)
  }

  async keypair(did: string): Promise<Keypair> {
    const { keyLocation } = await this.getLocation(did)
    const privKey = await fs.readFile(keyLocation)
    return crypto.Secp256k1Keypair.import(privKey)
  }

  async openDb(did: string): Promise<ActorDb> {
    const { dbLocation } = await this.getLocation(did)
    const exists = await fileExists(dbLocation)
    if (!exists) {
      throw new InvalidRequestError('Repo not found', 'NotFound')
    }

    const db = getDb(dbLocation, this.cfg.disableWalAutoCheckpoint)

    // run a simple select with retry logic to ensure the db is ready (not in wal recovery mode)
    try {
      await retrySqlite(() =>
        db.db.selectFrom('repo_root').selectAll().execute(),
      )
    } catch (err) {
      db.close()
      throw err
    }

    return db
  }

  async read<T>(did: string, fn: ActorStoreReadFn<T>) {
    const db = await this.openDb(did)
    try {
      const reader = createActorReader(did, db, this.resources, () =>
        this.keypair(did),
      )
      return await fn(reader)
    } finally {
      db.close()
    }
  }

  async transact<T>(did: string, fn: ActorStoreTransactFn<T>) {
    const keypair = await this.keypair(did)
    const db = await this.openDb(did)
    try {
      return await db.transaction((dbTxn) => {
        const store = createActorTransactor(did, dbTxn, keypair, this.resources)
        return fn(store)
      })
    } finally {
      db.close()
    }
  }

  async writeNoTransaction<T>(did: string, fn: ActorStoreWriterFn<T>) {
    const keypair = await this.keypair(did)
    const db = await this.openDb(did)
    try {
      const writer = createActorTransactor(did, db, keypair, this.resources)
      return await fn({
        ...writer,
        transact: async <T>(fn: ActorStoreTransactFn<T>): Promise<T> => {
          return db.transaction((dbTxn) => {
            const transactor = createActorTransactor(
              did,
              dbTxn,
              keypair,
              this.resources,
            )
            return fn(transactor)
          })
        },
      })
    } finally {
      db.close()
    }
  }

  async create(did: string, keypair: ExportableKeypair) {
    const { directory, dbLocation, keyLocation } = await this.getLocation(did)
    // ensure subdir exists
    await mkdir(directory, { recursive: true })
    const exists = await fileExists(dbLocation)
    if (exists) {
      throw new InvalidRequestError('Repo already exists', 'AlreadyExists')
    }
    const privKey = await keypair.export()
    await fs.writeFile(keyLocation, privKey)

    const db: ActorDb = getDb(dbLocation, this.cfg.disableWalAutoCheckpoint)
    try {
      await db.ensureWal()
      const migrator = getMigrator(db)
      await migrator.migrateToLatestOrThrow()
    } finally {
      db.close()
    }
  }

  async destroy(did: string) {
    const blobstore = this.resources.blobstore(did)
    if (blobstore instanceof DiskBlobStore) {
      await blobstore.deleteAll()
    } else {
      const blobRows = await this.read(did, (store) =>
        store.db.db.selectFrom('blob').select('cid').execute(),
      )
      const cids = blobRows.map((row) => CID.parse(row.cid))
      await Promise.allSettled(
        chunkArray(cids, 500).map((chunk) => blobstore.deleteMany(chunk)),
      )
    }

    const { directory } = await this.getLocation(did)
    await rmIfExists(directory, true)
  }

  async reserveKeypair(did?: string): Promise<string> {
    let keyLoc: string | undefined
    if (did) {
      assertSafePathPart(did)
      keyLoc = path.join(this.reservedKeyDir, did)
      const maybeKey = await loadKey(keyLoc)
      if (maybeKey) {
        return maybeKey.did()
      }
    }
    const keypair = await crypto.Secp256k1Keypair.create({ exportable: true })
    const keyDid = keypair.did()
    keyLoc = keyLoc ?? path.join(this.reservedKeyDir, keyDid)
    await mkdir(this.reservedKeyDir, { recursive: true })
    await fs.writeFile(keyLoc, await keypair.export())
    return keyDid
  }

  async getReservedKeypair(
    signingKeyOrDid: string,
  ): Promise<ExportableKeypair | undefined> {
    return loadKey(path.join(this.reservedKeyDir, signingKeyOrDid))
  }

  async clearReservedKeypair(keyDid: string, did?: string) {
    await rmIfExists(path.join(this.reservedKeyDir, keyDid))
    if (did) {
      await rmIfExists(path.join(this.reservedKeyDir, did))
    }
  }

  async storePlcOp(did: string, op: Uint8Array) {
    const { directory } = await this.getLocation(did)
    const opLoc = path.join(directory, `did-op`)
    await fs.writeFile(opLoc, op)
  }

  async getPlcOp(did: string): Promise<Uint8Array> {
    const { directory } = await this.getLocation(did)
    const opLoc = path.join(directory, `did-op`)
    return await fs.readFile(opLoc)
  }

  async clearPlcOp(did: string) {
    const { directory } = await this.getLocation(did)
    const opLoc = path.join(directory, `did-op`)
    await rmIfExists(opLoc)
  }
}

const loadKey = async (loc: string): Promise<ExportableKeypair | undefined> => {
  const privKey = await readIfExists(loc)
  if (!privKey) return undefined
  return crypto.Secp256k1Keypair.import(privKey, { exportable: true })
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
    did,
    db,
    repo: new RepoTransactor(db, did, keypair, userBlobstore, backgroundQueue),
    record: new RecordTransactor(db, userBlobstore),
    pref: new PreferenceTransactor(db),
  }
}

const createActorReader = (
  did: string,
  db: ActorDb,
  resources: ActorStoreResources,
  getKeypair: () => Promise<Keypair>,
): ActorStoreReader => {
  const { blobstore } = resources
  return {
    did,
    db,
    repo: new RepoReader(db, blobstore(did)),
    record: new RecordReader(db),
    pref: new PreferenceReader(db),
    keypair: getKeypair,
    transact: async <T>(fn: ActorStoreTransactFn<T>): Promise<T> => {
      const keypair = await getKeypair()
      return db.transaction((dbTxn) => {
        const store = createActorTransactor(did, dbTxn, keypair, resources)
        return fn(store)
      })
    },
  }
}

export type ActorStoreReadFn<T> = (fn: ActorStoreReader) => Promise<T>
export type ActorStoreTransactFn<T> = (fn: ActorStoreTransactor) => Promise<T>
export type ActorStoreWriterFn<T> = (fn: ActorStoreWriter) => Promise<T>

export type ActorStoreReader = {
  did: string
  db: ActorDb
  repo: RepoReader
  record: RecordReader
  pref: PreferenceReader
  keypair: () => Promise<Keypair>
  transact: <T>(fn: ActorStoreTransactFn<T>) => Promise<T>
}

export type ActorStoreTransactor = {
  did: string
  db: ActorDb
  repo: RepoTransactor
  record: RecordTransactor
  pref: PreferenceTransactor
}

export type ActorStoreWriter = ActorStoreTransactor & {
  transact: <T>(fn: ActorStoreTransactFn<T>) => Promise<T>
}

function assertSafePathPart(part: string) {
  const normalized = path.normalize(part)
  assert(
    part === normalized &&
      !part.startsWith('.') &&
      !part.includes('/') &&
      !part.includes('\\'),
    `unsafe path part: ${part}`,
  )
}
