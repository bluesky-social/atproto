import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
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
