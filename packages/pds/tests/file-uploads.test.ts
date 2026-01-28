import fs from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import * as uint8arrays from 'uint8arrays'
import { randomBytes } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { Client, DidString } from '@atproto/lex'
import { BlobRef } from '@atproto/lex-data'
import { AppContext } from '../src'
import { ActorDb } from '../src/actor-store/db'
import { DiskBlobStore } from '../src/disk-blobstore'
import { app } from '../src/lexicons/index.js'
import { users } from './seeds/users'

describe('file uploads', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let aliceDb: ActorDb
  let alice: DidString
  let bob: DidString
  let client: Client
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'file_uploads',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    client = network.pds.getClient()
    sc = network.getSeedClient()
    await sc.createAccount('alice', users.alice)
    await sc.createAccount('bob', users.bob)
    alice = sc.dids.alice
    bob = sc.dids.bob
    aliceDb = await network.pds.ctx.actorStore.openDb(alice)
  })

  afterAll(async () => {
    aliceDb.close()
    await network.close()
  })

  let smallBlob: BlobRef
  let smallFile: Uint8Array

  it('handles client abort', async () => {
    const abortController = new AbortController()
    const BlobStore = ctx.blobstore('did:invalid')
      .constructor as typeof DiskBlobStore
    const _putTemp = BlobStore.prototype.putTemp
    BlobStore.prototype.putTemp = function (...args) {
      // Abort just as processing blob in packages/pds/src/services/repo/blobs.ts
      process.nextTick(() => abortController.abort())
      return _putTemp.call(this, ...args)
    }
    const response = fetch(
      `${network.pds.url}/xrpc/com.atproto.repo.uploadBlob`,
      {
        method: 'post',
        body: Buffer.alloc(5000000), // Enough bytes to get some chunking going on
        signal: abortController.signal,
        headers: {
          ...sc.getHeaders(alice),
          'content-type': 'image/jpeg',
        },
      },
    )
    await expect(response).rejects.toThrow('operation was aborted')
    // Cleanup
    BlobStore.prototype.putTemp = _putTemp
    // This test would fail from an uncaught exception: this grace period gives time for that to surface
    await new Promise((res) => setTimeout(res, 10))
  })

  it('uploads files', async () => {
    smallFile = await fs.readFile('../dev-env/assets/key-portrait-small.jpg')
    const res = await client.uploadBlob(smallFile, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })
    smallBlob = res.body.blob

    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', smallBlob.ref.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('image/jpeg')
    expect(found?.size).toBe(smallFile.length)
    expect(found?.tempKey).toBeDefined()
    const hasKey = await ctx.blobstore(alice).hasTemp(found?.tempKey as string)
    expect(hasKey).toBeTruthy()
  })

  it('can reference the file', async () => {
    await sc.updateProfile(alice, { displayName: 'Alice', avatar: smallBlob })
  })

  it('after being referenced, the file is moved to permanent storage', async () => {
    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', smallBlob.ref.toString())
      .executeTakeFirst()
    expect(found?.tempKey).toBeNull()
    const hasStored = ctx.blobstore(alice).hasStored(smallBlob.ref)
    expect(hasStored).toBeTruthy()
    const storedBytes = await ctx.blobstore(alice).getBytes(smallBlob.ref)
    expect(uint8arrays.equals(smallFile, storedBytes)).toBeTruthy()
  })

  it('can fetch the file after being referenced', async () => {
    const { headers, body } = await client.getBlob(
      alice,
      smallBlob.ref.toString(),
    )
    expect(headers['content-type']).toEqual('image/jpeg')
    expect(headers['content-security-policy']).toEqual(
      `default-src 'none'; sandbox`,
    )
    expect(headers['x-content-type-options']).toEqual('nosniff')
    expect(uint8arrays.equals(smallFile, body)).toBeTruthy()
  })

  let largeBlob: BlobRef
  let largeFile: Uint8Array

  it('does not allow referencing a file that is outside blob constraints', async () => {
    largeFile = await fs.readFile('../dev-env/assets/hd-key.jpg')
    const res = await client.uploadBlob(largeFile, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })
    largeBlob = res.body.blob

    const profilePromise = sc.updateProfile(alice, {
      avatar: largeBlob,
    })

    await expect(profilePromise).rejects.toThrow()
  })

  it('does not make a blob permanent if referencing failed', async () => {
    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', largeBlob.ref.toString())
      .executeTakeFirst()

    expect(found?.tempKey).toBeDefined()
    const hasTemp = await ctx.blobstore(alice).hasTemp(found?.tempKey as string)
    expect(hasTemp).toBeTruthy()
    const hasStored = await ctx.blobstore(alice).hasStored(largeBlob.ref)
    expect(hasStored).toBeFalsy()
  })

  it('permits duplicate uploads of the same file', async () => {
    const file = await fs.readFile('../dev-env/assets/key-landscape-small.jpg')
    const { body: uploadA } = await client.uploadBlob(file, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })
    const { body: uploadB } = await client.uploadBlob(file, {
      headers: sc.getHeaders(bob),
      encoding: 'image/jpeg',
    })
    expect(uploadA).toEqual(uploadB)

    await sc.updateProfile(alice, {
      displayName: 'Alice',
      avatar: uploadA.blob,
    })
    const profileA = await client.get(app.bsky.actor.profile, {
      repo: alice,
      rkey: 'self',
    })
    // @ts-expect-error "cid" is not documented as "com.atproto.repo.uploadBlob" output
    expect(profileA.value.avatar.cid).toEqual(uploadA.cid)
    await sc.updateProfile(bob, {
      displayName: 'Bob',
      avatar: uploadB.blob,
    })
    const profileB = await client.get(app.bsky.actor.profile, {
      repo: bob,
      rkey: 'self',
    })
    // @ts-expect-error "cid" is not documented as "com.atproto.repo.uploadBlob" output
    expect(profileB.value.avatar.cid).toEqual(uploadA.cid)
    const { body: uploadAfterPermanent } = await client.uploadBlob(file, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })
    expect(uploadAfterPermanent).toEqual(uploadA)
    const blob = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', uploadAfterPermanent.blob.ref.toString())
      .executeTakeFirstOrThrow()
    expect(blob.tempKey).toEqual(null)
  })

  it('supports compression during upload', async () => {
    const { body: uploaded } = await client.uploadBlob(gzipSync(smallFile), {
      encoding: 'image/jpeg',
      headers: {
        ...sc.getHeaders(alice),
        'content-encoding': 'gzip',
      },
    })
    expect(uploaded.blob.ref.equals(smallBlob.ref)).toBeTruthy()
  })

  it('corrects a bad mimetype', async () => {
    const file = await fs.readFile('../dev-env/assets/key-landscape-large.jpg')
    const res = await client.uploadBlob(file, {
      headers: sc.getHeaders(alice),
      encoding: 'video/mp4',
    })

    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', res.body.blob.ref.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('image/jpeg')
  })

  it('handles pngs', async () => {
    const file = await fs.readFile('../dev-env/assets/at.png')
    const res = await client.uploadBlob(file, {
      headers: sc.getHeaders(alice),
      encoding: 'image/png',
    })

    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', res.body.blob.ref.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('image/png')
  })

  it('handles unknown mimetypes', async () => {
    const file = await randomBytes(20000)
    const res = await client.uploadBlob(file, {
      headers: sc.getHeaders(alice),
      encoding: 'test/fake',
    })

    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', res.body.blob.ref.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('test/fake')
  })

  it('handles text', async () => {
    const file = 'hello world!'
    const res = await client.uploadBlob(file, {
      headers: sc.getHeaders(alice),
      encoding: 'text/plain',
    })

    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', res.body.blob.ref.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('text/plain')
  })

  it('handles json', async () => {
    const file = '{"hello":"world"}'
    const res = await client.uploadBlob(file, {
      headers: sc.getHeaders(alice),
      encoding: 'application/json',
    })

    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', res.body.blob.ref.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('application/json')
  })
})
