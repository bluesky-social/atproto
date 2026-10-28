import assert from 'node:assert'
import fs, { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileExists, readIfExists, rmIfExists } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import type { ExportableKeypair, Keypair } from '@atproto/crypto'
import type { DidString } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { ActorStoreConfig } from '../config/index.js'
import { retrySqlite } from '../db/index.js'
import { DiskBlobStore } from '../disk-blobstore.js'
import { blobStoreLogger } from '../logger.js'
import { ActorStoreReader } from './actor-store-reader.js'
import type { ActorStoreResources } from './actor-store-resources.js'
import { ActorStoreTransactor } from './actor-store-transactor.js'
import { ActorStoreWriter } from './actor-store-writer.js'
import { type ActorDb, getDb, getMigrator } from './db/index.js'

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
      await db.close()
      throw err
    }

    return db
  }

  async read<T>(
    did: DidString,
    fn: (fn: ActorStoreReader) => T | PromiseLike<T>,
  ) {
    await using db = await this.openDb(did)
    const getKeypair = () => this.keypair(did)
    await using reader = new ActorStoreReader(
      did,
      db,
      this.resources,
      getKeypair,
    )
    return await fn(reader)
  }

  async transact<T>(
    did: DidString,
    fn: (transactor: ActorStoreTransactor) => T | PromiseLike<T>,
  ) {
    const keypair = await this.keypair(did)
    await using db = await this.openDb(did)
    return await db.transaction(async (dbTxn) => {
      await using transactor = new ActorStoreTransactor(
        did,
        dbTxn,
        keypair,
        this.resources,
      )
      return await fn(transactor)
    })
  }

  async writeNoTransaction<T>(
    did: DidString,
    fn: (writer: ActorStoreWriter) => T | PromiseLike<T>,
  ) {
    const keypair = await this.keypair(did)
    await using db = await this.openDb(did)
    await using writer = new ActorStoreWriter(did, db, keypair, this.resources)
    return await fn(writer)
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
      await db.close()
    }
  }

  async destroy(did: DidString) {
    await using blobstore = this.resources.blobstore(did)
    if (blobstore instanceof DiskBlobStore) {
      await blobstore.deleteAll()
    } else {
      const cids = await this.read(did, async (store) =>
        store.repo.blob.getBlobCids(),
      )
      await blobstore.deleteMany(cids).catch((err) => {
        blobStoreLogger.error({ did, cids, err }, 'Failed to delete blobs')
      })
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
