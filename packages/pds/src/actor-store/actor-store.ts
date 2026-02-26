import assert from 'node:assert'
import fs, { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileExists, readIfExists, rmIfExists } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { ExportableKeypair, Keypair } from '@atproto/crypto'
import { InternalServerError, InvalidRequestError } from '@atproto/xrpc-server'
import { AccountDb } from '../account-manager/db'
import { countInProgressMigrations } from '../account-manager/helpers/actor-store-migration'
import { ActorStoreConfig } from '../config'
import { retrySqlite } from '../db'
import { DiskBlobStore } from '../disk-blobstore'
import { blobStoreLogger } from '../logger'
import { ActorStoreReader } from './actor-store-reader'
import { ActorStoreResources } from './actor-store-resources'
import { ActorStoreTransactor } from './actor-store-transactor'
import { ActorStoreWriter } from './actor-store-writer'
import { ActorDb, getDb, getMigrationLevel, getMigrator } from './db'
import { getLatestStoreSchemaVersion } from './db/migrations'

export class ActorStore {
  reservedKeyDir: string

  constructor(
    public cfg: ActorStoreConfig,
    public resources: ActorStoreResources,
    public accountDb: AccountDb,
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

  async openDb(
    did: string,
    opts?: { migrateOnOpen?: boolean },
  ): Promise<ActorDb> {
    const { migrateOnOpen = true } = opts ?? {}
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
      if (migrateOnOpen) {
        await this.ensureMigrated(did, db)
      }
    } catch (err) {
      db.close()
      throw err
    }

    return db
  }

  // Ensures the actor's SQLite store is at the latest schema version.
  // If storeSchemaVersion is already LATEST, this is a no-op.
  // Otherwise, we run the migrator. If a concurrent caller is already
  // migrating the same store, SQLite serializes the writes - the second
  // caller blocks until the first completes, then sees all migrations
  // already applied (no-op).
  private async ensureMigrated(did: string, db: ActorDb): Promise<void> {
    const lastMigration = await getMigrationLevel(db)
    if (lastMigration === getLatestStoreSchemaVersion()) {
      // already up to date
      return
    }

    // We need to do a migration

    if (
      (await countInProgressMigrations(this.accountDb)) >=
      this.cfg.maxConcurrentMigrations
    ) {
      throw new InternalServerError(
        'too many concurrent actor store migrations',
      )
    }

    await this.accountDb.db
      .updateTable('actor')
      .set({ storeIsMigrating: 1, storeMigratedAt: new Date().toISOString() })
      .where('did', '=', did)
      .where('storeIsMigrating', '=', 0) // don't bump storeMigratedAt if there's a concurrent migration
      .execute()

    try {
      await getMigrator(db).migrateToLatestOrThrow()

      // NOTE: If the process dies here (after migration but before the account db has been updated),
      // the account db and the actor store will be out of sync

      await this.accountDb.db
        .updateTable('actor')
        .set({
          storeSchemaVersion: getLatestStoreSchemaVersion(),
          storeIsMigrating: 0,
          storeMigratedAt: new Date().toISOString(),
        })
        .where('did', '=', did)
        .execute()
    } catch (err) {
      await this.accountDb.db
        .updateTable('actor')
        .set({ storeIsMigrating: 0 })
        .where('did', '=', did)
        .execute()
      throw err
    }
  }

  async read<T>(did: string, fn: (fn: ActorStoreReader) => T | PromiseLike<T>) {
    const db = await this.openDb(did)
    try {
      const getKeypair = () => this.keypair(did)
      return await fn(new ActorStoreReader(did, db, this.resources, getKeypair))
    } finally {
      db.close()
    }
  }

  async transact<T>(
    did: string,
    fn: (fn: ActorStoreTransactor) => T | PromiseLike<T>,
  ) {
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

  async writeNoTransaction<T>(
    did: string,
    fn: (fn: ActorStoreWriter) => T | PromiseLike<T>,
  ) {
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
      await blobstore.deleteMany(cids).catch((err) => {
        blobStoreLogger.error('Failed to delete blobs', { did, cids, err })
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
