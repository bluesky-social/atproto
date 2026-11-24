import assert from 'node:assert'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ActorStore } from '../src/actor-store/actor-store.js'
import { BackgroundQueue } from '../src/background.js'

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
      await expect(store.clearReservedKeys(part)).rejects.toThrow(
        'unsafe path part',
      )
    },
  )

  it('clears reservations filed under the DID and under its stored keys', async () => {
    const did = 'did:web:example.com'
    await store.reserveSigningKeypair(did)
    await store.reserveKemKeypair(did)
    const signingKey = await store.reserveSigningKeypair()
    const kemKey = await store.reserveKemKeypair()
    const otherSigningKey = await store.reserveSigningKeypair()
    const otherKemKey = await store.reserveKemKeypair()
    const signingKeypair = await store.getReservedSigningKeypair(signingKey)
    const kemKeypair = await store.getReservedKemKeypair(kemKey)
    assert(signingKeypair && kemKeypair)
    await store.create(did, signingKeypair, kemKeypair)

    await store.clearReservedKeys(did)

    await expect(store.getReservedSigningKeypair(did)).resolves.toBeUndefined()
    await expect(store.getReservedKemKeypair(did)).resolves.toBeUndefined()
    await expect(
      store.getReservedSigningKeypair(signingKey),
    ).resolves.toBeUndefined()
    await expect(store.getReservedKemKeypair(kemKey)).resolves.toBeUndefined()
    // Another account's reservations are left alone
    expect(
      (await store.getReservedSigningKeypair(otherSigningKey))?.did(),
    ).toBe(otherSigningKey)
    expect((await store.getReservedKemKeypair(otherKemKey))?.did()).toBe(
      otherKemKey,
    )
  })

  it('keeps reservations when the account has no store', async () => {
    const did = 'did:web:example.com'
    const signingKey = await store.reserveSigningKeypair(did)
    const kemKey = await store.reserveKemKeypair(did)

    await expect(store.clearReservedKeys(did)).rejects.toThrow('ENOENT')

    expect((await store.getReservedSigningKeypair(did))?.did()).toBe(signingKey)
    expect((await store.getReservedKemKeypair(did))?.did()).toBe(kemKey)
  })
})
