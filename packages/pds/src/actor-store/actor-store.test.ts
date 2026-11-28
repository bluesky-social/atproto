import fs, { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import SqliteDB from 'better-sqlite3'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { P256Keypair, Secp256k1Keypair } from '@atproto/crypto'
import type { DidString } from '@atproto/lex-schema'
import type { BlobStore } from '@atproto/repo'
import { BackgroundQueue } from '../background.js'
import { Migrator } from '../db/migrator.js'
import { ActorStore } from './actor-store.js'

describe('actor store paths', () => {
  let directory: string
  let store: ActorStore
  const backgroundQueue = new BackgroundQueue(undefined)

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'actor-store-paths-'))
    store = new ActorStore(
      {
        directory,
        cacheSize: 0,
        disableWalAutoCheckpoint: false,
        synchronousFull: false,
      },
      {
        backgroundQueue,
        blobstore: () => {
          throw new Error('Unexpected blob store access')
        },
      },
    )
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  afterAll(async () => {
    await backgroundQueue.destroy()
  })

  it.each(['../escape', 'did:web:example.com/../../escape', '..\\escape', '.'])(
    'rejects unsafe account and reservation paths: %s',
    async (part) => {
      await expect(store.getLocation(part)).rejects.toThrow('unsafe path part')
      await expect(store.reserveSigningKeypair(part)).rejects.toThrow(
        'unsafe path part',
      )
      await expect(store.reserveKemKeypair(part)).rejects.toThrow(
        'unsafe path part',
      )
      await expect(store.getReservedSigningKeypair(part)).rejects.toThrow(
        'unsafe path part',
      )
      await expect(store.getReservedKemKeypair(part)).rejects.toThrow(
        'unsafe path part',
      )
    },
  )

  it.each(['did', 'signingKey', 'kemKey'] as const)(
    'validates %s before deleting any reservations',
    async (invalidField) => {
      const did = 'did:web:example.com'
      const signingKey = await store.reserveSigningKeypair(did)
      const kemKey = await store.reserveKemKeypair(did)
      const paths = [
        path.join(store.reservedSigningKeyDir, did),
        path.join(store.reservedKemKeyDir, did),
      ]
      const before = await Promise.all(paths.map((loc) => readFile(loc)))
      const input = { did, signingKey, kemKey, [invalidField]: '../escape' }

      await expect(store.clearReservedKeys(input.did, input)).rejects.toThrow(
        'unsafe path part',
      )

      expect(await Promise.all(paths.map((loc) => readFile(loc)))).toEqual(
        before,
      )
      expect((await store.getReservedSigningKeypair(did))?.did()).toBe(
        signingKey,
      )
      expect((await store.getReservedKemKeypair(did))?.did()).toBe(kemKey)

      await store.clearReservedKeys(did, { signingKey, kemKey })
      await expect(
        store.getReservedSigningKeypair(did),
      ).resolves.toBeUndefined()
      await expect(store.getReservedKemKeypair(did)).resolves.toBeUndefined()
    },
  )

  it('clears reservations filed under each key', async () => {
    const signingKey = await store.reserveSigningKeypair()
    const kemKey = await store.reserveKemKeypair()
    expect((await store.getReservedSigningKeypair(signingKey))?.did()).toBe(
      signingKey,
    )
    expect((await store.getReservedKemKeypair(kemKey))?.did()).toBe(kemKey)

    await store.clearReservedKeys('did:web:example.com', { signingKey, kemKey })

    await expect(
      store.getReservedSigningKeypair(signingKey),
    ).resolves.toBeUndefined()
    await expect(store.getReservedKemKeypair(kemKey)).resolves.toBeUndefined()
  })
})

describe('kem key storage', () => {
  let tmpDir: string
  let store: ActorStore
  const backgroundQueue = new BackgroundQueue(undefined)

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'kem-key-storage-'))
    store = new ActorStore(
      {
        directory: tmpDir,
        cacheSize: 0,
        disableWalAutoCheckpoint: false,
        synchronousFull: false,
      },
      {
        backgroundQueue,
        blobstore: () => {
          throw new Error('Unexpected blob store access')
        },
      },
    )
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
    await backgroundQueue.destroy()
  })
  it('creates a kem key once under concurrent ensure', async () => {
    const did = 'did:example:concurrent'
    const { directory, kemKeyLocation } = await store.getLocation(did)
    await fs.mkdir(directory, { recursive: true })
    expect(await store.kemKeypair(did)).toBeUndefined()

    const keys = await Promise.all(
      Array.from({ length: 10 }, () => store.ensureKemKeypair(did)),
    )
    expect(new Set(keys.map((k) => k.did())).size).toBe(1)

    const onDisk = await P256Keypair.import(await fs.readFile(kemKeyLocation))
    expect(onDisk.did()).toBe(keys[0].did())
    expect((await store.kemKeypair(did))?.did()).toBe(keys[0].did())
    const leftovers = (await fs.readdir(directory)).filter((f) =>
      f.endsWith('.tmp'),
    )
    expect(leftovers).toEqual([])
  })

  it('does not create the directory of an account that is gone', async () => {
    const did = 'did:example:gone'
    const { directory } = await store.getLocation(did)
    await expect(store.ensureKemKeypair(did)).rejects.toThrow()
    await expect(fs.access(directory)).rejects.toThrow()
  })

  it('never overwrites an existing kem key', async () => {
    const did = 'did:example:created'
    const kem = await P256Keypair.create({ exportable: true })
    const signing = await Secp256k1Keypair.create({ exportable: true })
    await store.create(did, signing, kem)
    const ensured = await store.ensureKemKeypair(did)
    expect(ensured.did()).toBe(kem.did())
    expect((await store.kemKeypair(did))?.did()).toBe(kem.did())
  })

  it('replaces an orphaned kem key when create runs without a store', async () => {
    const did = 'did:example:orphan'
    const { directory, kemKeyLocation } = await store.getLocation(did)
    await fs.mkdir(directory, { recursive: true })
    const orphan = await P256Keypair.create({ exportable: true })
    await fs.writeFile(kemKeyLocation, await orphan.export())

    const kem = await P256Keypair.create({ exportable: true })
    const signing = await Secp256k1Keypair.create({ exportable: true })
    await store.create(did, signing, kem)
    const onDisk = await P256Keypair.import(await fs.readFile(kemKeyLocation))
    expect(onDisk.did()).toBe(kem.did())
    expect(onDisk.did()).not.toBe(orphan.did())
  })

  it('leaves the kem key untouched when the store already exists', async () => {
    const did = 'did:example:existing'
    const kem = await P256Keypair.create({ exportable: true })
    const signing = await Secp256k1Keypair.create({ exportable: true })
    await store.create(did, signing, kem)
    const { kemKeyLocation } = await store.getLocation(did)
    const before = await fs.readFile(kemKeyLocation)

    const otherKem = await P256Keypair.create({ exportable: true })
    await expect(store.create(did, signing, otherKem)).rejects.toThrow(
      'Repo already exists',
    )
    expect(Buffer.from(await fs.readFile(kemKeyLocation))).toEqual(
      Buffer.from(before),
    )
    expect((await store.kemKeypair(did))?.did()).toBe(kem.did())
  })

  it('reserves and reloads a kem key by did and by key', async () => {
    const did = 'did:example:reserved'
    const keyDid = await store.reserveKemKeypair(did)
    expect(keyDid).toMatch(/^did:key:/)
    // reserving again for the same did is stable
    expect(await store.reserveKemKeypair(did)).toBe(keyDid)
    expect((await store.getReservedKemKeypair(did))?.did()).toBe(keyDid)

    // without a did, the key is stored under its own did:key
    const anonKeyDid = await store.reserveKemKeypair()
    expect((await store.getReservedKemKeypair(anonKeyDid))?.did()).toBe(
      anonKeyDid,
    )
  })
})

const SPACE_TABLES = [
  'space',
  'memberspace_member',
  'space_policy',
  'space_record',
  'space_record_blob',
  'space_repo',
  'space_record_oplog',
  'space_writer',
  'space_notify_registration',
]

describe('actor store migration on open', () => {
  let directory: string
  let store: ActorStore
  const backgroundQueue = new BackgroundQueue(undefined)

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'actor-store-migrate-'))
    store = new ActorStore(
      {
        directory,
        cacheSize: 0,
        disableWalAutoCheckpoint: false,
        synchronousFull: false,
      },
      {
        backgroundQueue,
        // @NOTE Readers open (and dispose of) the account's blob store
        blobstore: () =>
          ({ async [Symbol.asyncDispose]() {} }) as unknown as BlobStore,
      },
    )
  })

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true })
    await backgroundQueue.destroy()
  })

  let counter = 0
  // As com.atproto.server.createAccount sets up its store
  const createAccount = async () => {
    const did = `did:example:user${counter++}` as DidString
    await store.create(
      did,
      await Secp256k1Keypair.create({ exportable: true }),
      await P256Keypair.create({ exportable: true }),
    )
    await store.transact(did, (txn) => txn.repo.createRepo([]))
    return did
  }

  const withFile = async <T>(did: string, fn: (db: SqliteDB.Database) => T) => {
    const { dbLocation } = await store.getLocation(did)
    const db = new SqliteDB(dbLocation)
    try {
      return fn(db)
    } finally {
      db.close()
    }
  }

  // A store as created by the release before spaces: migration '001' only
  const createPreSpacesStore = async () => {
    const did = await createAccount()
    await withFile(did, (db) => {
      for (const table of SPACE_TABLES) db.exec(`drop table "${table}"`)
      db.prepare('delete from kysely_migration where name = ?').run('002')
    })
    return did
  }

  const tables = (did: string) =>
    withFile(did, (db) =>
      db
        .prepare("select name from sqlite_master where type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name),
    )

  const migrations = (did: string) =>
    withFile(did, (db) =>
      db
        .prepare('select name from kysely_migration order by name')
        .all()
        .map((row) => (row as { name: string }).name),
    )

  it('migrates a pre-spaces store when it is opened', async () => {
    const did = await createPreSpacesStore()
    expect(await tables(did)).not.toContain('space')

    await store.read(did, async (reader) => {
      await reader.repo.storage.getRoot()
    })

    expect(await tables(did)).toEqual(expect.arrayContaining(SPACE_TABLES))
    expect(await migrations(did)).toEqual(['001', '002'])
  })

  it('migrates once when two requests open a pre-spaces store together', async () => {
    const did = await createPreSpacesStore()
    const read = () => store.read(did, async () => {})
    await Promise.all([read(), read()])
    expect(await migrations(did)).toEqual(['001', '002'])
    expect(await tables(did)).toContain('space')
  })

  it('does not run the migrator when the store is current', async () => {
    const did = await createAccount()
    using spy = vi.spyOn(Migrator.prototype, 'migrateToLatestOrThrow')
    await store.read(did, async () => {})
    expect(spy).toHaveBeenCalledTimes(0)
  })

  it('opens a store a newer version migrated', async () => {
    const did = await createAccount()
    await withFile(did, (db) =>
      db
        .prepare('insert into kysely_migration (name, timestamp) values (?, ?)')
        .run('999-future', new Date().toISOString()),
    )
    await store.read(did, async () => {})
    expect(await migrations(did)).toEqual(['001', '002', '999-future'])
  })
})
