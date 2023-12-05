import fs from 'fs/promises'
import { gzipSync } from 'zlib'
import AtpAgent from '@atproto/api'
import { AppContext } from '../src'
import DiskBlobStore from '../src/disk-blobstore'
import * as uint8arrays from 'uint8arrays'
import { randomBytes } from '@atproto/crypto'
import { BlobRef } from '@atproto/lexicon'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { users } from './seeds/users'
import { ActorDb } from '../src/actor-store/db'

describe('file uploads', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let aliceDb: ActorDb
  let alice: string
  let bob: string
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'file_uploads',
    })
    ctx = network.pds.ctx
    agent = network.pds.getClient()
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
    const _putTemp = DiskBlobStore.prototype.putTemp
    DiskBlobStore.prototype.putTemp = function (...args) {
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
    DiskBlobStore.prototype.putTemp = _putTemp
    // This test would fail from an uncaught exception: this grace period gives time for that to surface
    await new Promise((res) => setTimeout(res, 10))
  })

  it('uploads files', async () => {
    smallFile = await fs.readFile('tests/sample-img/key-portrait-small.jpg')
    const res = await agent.api.com.atproto.repo.uploadBlob(smallFile, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })
    smallBlob = res.data.blob

    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', smallBlob.ref.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('image/jpeg')
    expect(found?.size).toBe(smallFile.length)
    expect(found?.tempKey).toBeDefined()
    expect(found?.width).toBe(87)
    expect(found?.height).toBe(150)
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
    const { headers, data } = await agent.api.com.atproto.sync.getBlob({
      did: alice,
      cid: smallBlob.ref.toString(),
    })
    expect(headers['content-type']).toEqual('image/jpeg')
    expect(headers['content-security-policy']).toEqual(
      `default-src 'none'; sandbox`,
    )
    expect(headers['x-content-type-options']).toEqual('nosniff')
    expect(uint8arrays.equals(smallFile, new Uint8Array(data))).toBeTruthy()
  })

  let largeBlob: BlobRef
  let largeFile: Uint8Array

  it('does not allow referencing a file that is outside blob constraints', async () => {
    largeFile = await fs.readFile('tests/sample-img/hd-key.jpg')
    const res = await agent.api.com.atproto.repo.uploadBlob(largeFile, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })
    largeBlob = res.data.blob

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
    const file = await fs.readFile('tests/sample-img/key-landscape-small.jpg')
    const { data: uploadA } = await agent.api.com.atproto.repo.uploadBlob(
      file,
      {
        headers: sc.getHeaders(alice),
        encoding: 'image/jpeg',
      } as any,
    )
    const { data: uploadB } = await agent.api.com.atproto.repo.uploadBlob(
      file,
      {
        headers: sc.getHeaders(bob),
        encoding: 'image/jpeg',
      } as any,
    )
    expect(uploadA).toEqual(uploadB)

    await sc.updateProfile(alice, {
      displayName: 'Alice',
      avatar: uploadA.blob,
    })
    const profileA = await agent.api.app.bsky.actor.profile.get({
      repo: alice,
      rkey: 'self',
    })
    expect((profileA.value as any).avatar.cid).toEqual(uploadA.cid)
    await sc.updateProfile(bob, {
      displayName: 'Bob',
      avatar: uploadB.blob,
    })
    const profileB = await agent.api.app.bsky.actor.profile.get({
      repo: bob,
      rkey: 'self',
    })
    expect((profileB.value as any).avatar.cid).toEqual(uploadA.cid)
    const { data: uploadAfterPermanent } =
      await agent.api.com.atproto.repo.uploadBlob(file, {
        headers: sc.getHeaders(alice),
        encoding: 'image/jpeg',
      } as any)
    expect(uploadAfterPermanent).toEqual(uploadA)
    const blob = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', uploadAfterPermanent.blob.ref.toString())
      .executeTakeFirstOrThrow()
    expect(blob.tempKey).toEqual(null)
  })

  it('supports compression during upload', async () => {
    const { data: uploaded } = await agent.api.com.atproto.repo.uploadBlob(
      gzipSync(smallFile),
      {
        encoding: 'image/jpeg',
        headers: {
          ...sc.getHeaders(alice),
          'content-encoding': 'gzip',
        },
      } as any,
    )
    expect(uploaded.blob.ref.equals(smallBlob.ref)).toBeTruthy()
  })

  it('corrects a bad mimetype', async () => {
    const file = await fs.readFile('tests/sample-img/key-landscape-large.jpg')
    const res = await agent.api.com.atproto.repo.uploadBlob(file, {
      headers: sc.getHeaders(alice),
      encoding: 'video/mp4',
    } as any)

    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', res.data.blob.ref.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('image/jpeg')
    expect(found?.width).toBe(1280)
    expect(found?.height).toBe(742)
  })

  it('handles pngs', async () => {
    const file = await fs.readFile('tests/sample-img/at.png')
    const res = await agent.api.com.atproto.repo.uploadBlob(file, {
      headers: sc.getHeaders(alice),
      encoding: 'image/png',
    })

    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', res.data.blob.ref.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('image/png')
    expect(found?.width).toBe(554)
    expect(found?.height).toBe(532)
  })

  it('handles unknown mimetypes', async () => {
    const file = await randomBytes(20000)
    const res = await agent.api.com.atproto.repo.uploadBlob(file, {
      headers: sc.getHeaders(alice),
      encoding: 'test/fake',
    } as any)

    const found = await aliceDb.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', res.data.blob.ref.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('test/fake')
  })
})
