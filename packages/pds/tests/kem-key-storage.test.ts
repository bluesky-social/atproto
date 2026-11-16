import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { P256Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import { ActorStore } from '../src/actor-store/actor-store.js'

describe('kem key storage', () => {
  let plc: TestPlc
  let pds: TestPds
  let tmpDir: string
  let store: ActorStore

  beforeAll(async () => {
    plc = await TestPlc.create({})
    pds = await TestPds.create({ didPlcUrl: plc.url })
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kem-key-storage-'))
    const { cfg, resources } = pds.ctx.actorStore
    store = new ActorStore({ ...cfg, directory: tmpDir }, resources)
  })

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
    await pds?.close()
    await plc?.close()
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
    await store.clearReservedKemKeypair(keyDid, did)
    expect(await store.getReservedKemKeypair(did)).toBeUndefined()

    // without a did, the key is stored under its own did:key
    const anonKeyDid = await store.reserveKemKeypair()
    expect((await store.getReservedKemKeypair(anonKeyDid))?.did()).toBe(
      anonKeyDid,
    )
    await store.clearReservedKemKeypair(anonKeyDid)
    expect(await store.getReservedKemKeypair(anonKeyDid)).toBeUndefined()
  })
})
