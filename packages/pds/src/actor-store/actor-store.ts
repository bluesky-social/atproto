import assert from 'node:assert'
import { randomUUID } from 'node:crypto'
import fs, { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { sql } from 'kysely'
import { fileExists, readIfExists, rmIfExists } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import type { ExportableKeypair, Keypair } from '@atproto/crypto'
import type { DidString } from '@atproto/lex-schema'
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
import { LATEST_ACTOR_MIGRATION } from './db/latest.js'

export class ActorStore {
  reservedKeyDir: string
  reservedKemKeyDir: string

  constructor(
    public cfg: ActorStoreConfig,
    public resources: ActorStoreResources,
  ) {
    this.reservedKeyDir = path.join(cfg.directory, 'reserved_keys')
    this.reservedKemKeyDir = path.join(this.reservedKeyDir, 'kem')
  }

  async getLocation(did: string) {
    const didHash = await crypto.sha256Hex(did)
    const directory = path.join(this.cfg.directory, didHash.slice(0, 2), did)
    const dbLocation = path.join(directory, `store.sqlite`)
    const keyLocation = path.join(directory, `key`)
    const kemKeyLocation = path.join(directory, `kem_key`)
    return { directory, dbLocation, keyLocation, kemKeyLocation }
  }

  async exists(did: string): Promise<boolean> {
    const location = await this.getLocation(did)
    return await fileExists(location.dbLocation)
  }

  async kemKeypair(did: string): Promise<crypto.P256Keypair | undefined> {
    const { kemKeyLocation } = await this.getLocation(did)
    return loadKemKey(kemKeyLocation)
  }

  // A DID doc must never name a KEM key we do not hold, so the key file is
  // written once and never overwritten.
  async ensureKemKeypair(did: string): Promise<crypto.P256Keypair> {
    const { directory, kemKeyLocation } = await this.getLocation(did)
    const existing = await loadKemKey(kemKeyLocation)
    if (existing) return existing
    await mkdir(directory, { recursive: true })
    return writeKemKeyNoClobber(
      kemKeyLocation,
      await crypto.P256Keypair.create({ exportable: true }),
    )
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

    // run a simple select with retry logic to ensure the db is ready (not in wal recovery mode).
    // synchronous is per-connection and its pragma can hit the same busy error, so it shares the retry.
    try {
      const newest = await retrySqlite(async () => {
        if (this.cfg.synchronousFull) {
          await db.ensureSynchronousFull()
        }
        // the one cheap read: it surfaces wal recovery, and tells us whether
        // this store is behind the latest migration
        const result = await sql<{ name: string }>`
          select name from kysely_migration order by name desc limit 1
        `.execute(db.db)
        return result.rows.at(0)
      })
      // an empty table is treated as behind, and left to the migrator
      if (!newest || newest.name.localeCompare(LATEST_ACTOR_MIGRATION) < 0) {
        await getMigrator(db).migrateToLatestOrThrow()
      }
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

  async create(
    did: string,
    keypair: ExportableKeypair,
    kemKeypair: ExportableKeypair,
  ) {
    const { directory, dbLocation, keyLocation, kemKeyLocation } =
      await this.getLocation(did)
    // ensure subdir exists
    await mkdir(directory, { recursive: true })
    const exists = await fileExists(dbLocation)
    if (exists) {
      throw new InvalidRequestError('Repo already exists', 'AlreadyExists')
    }
    // A kem key with no store beside it is the orphan of a failed create and
    // was never published: replace it with the caller's key.
    await rmIfExists(kemKeyLocation)
    const privKey = await keypair.export()
    await fs.writeFile(keyLocation, privKey)
    const storedKem = await writeKemKeyNoClobber(kemKeyLocation, kemKeypair)
    assert(
      storedKem.did() === kemKeypair.did(),
      'a different kem key is already stored for this account',
    )

    const db: ActorDb = getDb(dbLocation, this.cfg.disableWalAutoCheckpoint)
    try {
      await db.ensureWal()
      if (this.cfg.synchronousFull) {
        await retrySqlite(() => db.ensureSynchronousFull())
      }
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

  async reserveKemKeypair(did?: string): Promise<string> {
    let keyLoc: string | undefined
    if (did) {
      assertSafePathPart(did)
      keyLoc = path.join(this.reservedKemKeyDir, did)
      const maybeKey = await loadKemKey(keyLoc)
      if (maybeKey) {
        return maybeKey.did()
      }
    }
    const keypair = await crypto.P256Keypair.create({ exportable: true })
    keyLoc = keyLoc ?? path.join(this.reservedKemKeyDir, keypair.did())
    await mkdir(this.reservedKemKeyDir, { recursive: true })
    const stored = await writeKemKeyNoClobber(keyLoc, keypair)
    return stored.did()
  }

  async getReservedKemKeypair(
    keyDidOrDid: string,
  ): Promise<ExportableKeypair | undefined> {
    assertSafePathPart(keyDidOrDid)
    return loadKemKey(path.join(this.reservedKemKeyDir, keyDidOrDid))
  }

  async clearReservedKemKeypair(keyDid: string, did?: string) {
    assertSafePathPart(keyDid)
    await rmIfExists(path.join(this.reservedKemKeyDir, keyDid))
    if (did) {
      assertSafePathPart(did)
      await rmIfExists(path.join(this.reservedKemKeyDir, did))
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

const loadKemKey = async (
  loc: string,
): Promise<crypto.P256Keypair | undefined> => {
  const privKey = await readIfExists(loc)
  if (!privKey) return undefined
  return crypto.P256Keypair.import(privKey, { exportable: true })
}

// Appears whole or not at all (tmp + link), and never replaces an existing
// file: on conflict the winner's key is returned. `rename` is deliberately
// not used since it would overwrite.
const writeKemKeyNoClobber = async (
  loc: string,
  keypair: ExportableKeypair,
): Promise<crypto.P256Keypair> => {
  const tmp = `${loc}.${randomUUID()}.tmp`
  try {
    const handle = await fs.open(tmp, 'wx')
    try {
      await handle.writeFile(await keypair.export())
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await fs.link(tmp, loc)
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'EEXIST') throw err
      const winner = await loadKemKey(loc)
      assert(winner, 'kem key vanished after EEXIST')
      return winner
    }
    // make the new directory entry durable
    const dirHandle = await fs.open(path.dirname(loc), 'r')
    try {
      await dirHandle.sync()
    } finally {
      await dirHandle.close()
    }
    return crypto.P256Keypair.import(await keypair.export(), {
      exportable: true,
    })
  } finally {
    await rmIfExists(tmp)
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
