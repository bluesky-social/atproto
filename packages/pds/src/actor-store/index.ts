import {
  chunkArray,
  fileExists,
  readIfExists,
  rmIfExists,
} from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { ExportableKeypair, Keypair } from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import assert from 'node:assert'
import fs, { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { BackgroundQueue } from '../background'
import { ActorStoreConfig } from '../config'
import { retrySqlite } from '../db'
import DiskBlobStore from '../disk-blobstore'
import { ActorDb, getDb, getMigrator } from './db'
import { PreferenceReader } from './preference/reader'
import { PreferenceTransactor } from './preference/transactor'
import { RecordReader } from './record/reader'
import { RecordTransactor } from './record/transactor'
import { RepoReader } from './repo/reader'
import { RepoTransactor } from './repo/transactor'

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
      const getKeypair = () => this.keypair(did)
      return await fn(new ActorStoreReader(did, db, this.resources, getKeypair))
    } finally {
      db.close()
    }
  }

  async transact<T>(did: string, fn: ActorStoreTransactFn<T>) {
    const keypair = await this.keypair(did)
    const db = await this.openDb(did)
    try {
      return await db.transaction((dbTxn) => {
        return fn(new ActorStoreTransactor(did, dbTxn, keypair, this.resources))
      })
    } finally {
      db.close()
    }
  }

  async writeNoTransaction<T>(did: string, fn: ActorStoreWriterFn<T>) {
    const keypair = await this.keypair(did)
    const db = await this.openDb(did)
    try {
      return await fn(new ActorStoreWriter(did, db, keypair, this.resources))
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
      const cids = await this.read(did, async (store) =>
        store.repo.blob.getBlobCids(),
      )
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

type Awaitable<T> = T | PromiseLike<T>

export type ActorStoreReadFn<T> = (fn: ActorStoreReader) => Awaitable<T>
export type ActorStoreTransactFn<T> = (fn: ActorStoreTransactor) => Awaitable<T>
export type ActorStoreWriterFn<T> = (fn: ActorStoreWriter) => Awaitable<T>

export class ActorStoreReader {
  public readonly repo: RepoReader
  public readonly record: RecordReader
  public readonly pref: PreferenceReader

  constructor(
    public readonly did: string,
    protected readonly db: ActorDb,
    protected readonly resources: ActorStoreResources,
    public readonly keypair: () => Promise<Keypair>,
  ) {
    const blobstore = resources.blobstore(did)

    this.repo = new RepoReader(db, blobstore)
    this.record = new RecordReader(db)
    this.pref = new PreferenceReader(db)

    // Invoke "keypair" once. Also avoids leaking "this" as keypair context.
    let keypairPromise: Promise<Keypair>
    this.keypair = () => (keypairPromise ??= Promise.resolve().then(keypair))
  }

  async transact<T>(fn: ActorStoreTransactFn<T>): Promise<T> {
    const keypair = await this.keypair()
    return this.db.transaction((dbTxn) => {
      const store = new ActorStoreTransactor(
        this.did,
        dbTxn,
        keypair,
        this.resources,
      )
      return fn(store)
    })
  }
}

export class ActorStoreTransactor {
  public readonly record: RecordTransactor
  public readonly repo: RepoTransactor
  public readonly pref: PreferenceTransactor

  constructor(
    public readonly did: string,
    protected readonly db: ActorDb,
    protected readonly keypair: Keypair,
    protected readonly resources: ActorStoreResources,
  ) {
    const blobstore = resources.blobstore(did)

    this.record = new RecordTransactor(db, blobstore)
    this.pref = new PreferenceTransactor(db)
    this.repo = new RepoTransactor(
      db,
      blobstore,
      did,
      keypair,
      resources.backgroundQueue,
    )
  }
}

export class ActorStoreWriter extends ActorStoreTransactor {
  async transact<T>(fn: ActorStoreTransactFn<T>): Promise<T> {
    return this.db.transaction((dbTxn) => {
      const transactor = new ActorStoreTransactor(
        this.did,
        dbTxn,
        this.keypair,
        this.resources,
      )
      return fn(transactor)
    })
  }
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
