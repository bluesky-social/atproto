import assert from 'node:assert'
import fs from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import { jest } from '@jest/globals'
import * as uint8arrays from 'uint8arrays'
import { S3BlobStore } from '@atproto/aws'
import { randomBytes } from '@atproto/crypto'
import { type SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import type { Client, DidString } from '@atproto/lex'
import {
  type TypedBlobRef,
  getBlobCidString,
  isTypedBlobRef,
} from '@atproto/lex-data'
import type { ActorDb } from '../src/actor-store/db/index.js'
import type { DiskBlobStore } from '../src/disk-blobstore.js'
import type { AppContext } from '../src/index.js'
import { app, com } from '../src/lexicons/index.js'
import { users } from './seeds/users.js'

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
    // @TODO use an async disposable stack to manage the lifecycle of the
    // disposable resources.
    try {
      await aliceDb?.close()
    } finally {
      await network?.close()
    }
  })

  let smallBlob: TypedBlobRef
  let smallFile: Uint8Array<ArrayBuffer>

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
    assert(isTypedBlobRef(res.body.blob))
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
    expect(headers.get('content-type')).toEqual('image/jpeg')
    expect(headers.get('content-security-policy')).toEqual(
      `default-src 'none'; sandbox`,
    )
    expect(headers.get('x-content-type-options')).toEqual('nosniff')
    expect(uint8arrays.equals(smallFile, body)).toBeTruthy()
  })

  describe('S3 downloads', () => {
    it('redirects to a presigned URL and clients can follow it', async () => {
      const requests: string[] = []
      await using s3 = createServer((req, res) => {
        requests.push(req.method as string)
        const url = new URL(req.url as string, 'http://localhost')
        expect(decodeURIComponent(url.pathname)).toBe(
          `/blobs/blocks/${alice}/${smallBlob.ref}`,
        )
        if (req.method === 'HEAD') {
          res.writeHead(200).end()
        } else {
          expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy()
          res
            .writeHead(200, {
              'content-type': url.searchParams.get(
                'response-content-type',
              ) as string,
              'content-disposition': url.searchParams.get(
                'response-content-disposition',
              ) as string,
            })
            .end(smallFile)
        }
      }).listen(0, '127.0.0.1')
      await new Promise<void>((resolve) => s3.once('listening', resolve))
      const { port } = s3.address() as AddressInfo
      await using creator = S3BlobStore.creator({
        bucket: 'blobs',
        endpoint: `http://127.0.0.1:${port}`,
        region: 'auto',
        forcePathStyle: true,
        credentials: { accessKeyId: 'key', secretAccessKey: 'secret' },
      })
      using _blobstore = jest
        .spyOn(ctx.actorStore.resources, 'blobstore')
        .mockImplementation(creator)

      const url = new URL(
        `/xrpc/${com.atproto.sync.getBlob.$lxm}`,
        network.pds.url,
      )
      url.searchParams.set('did', alice)
      url.searchParams.set('cid', smallBlob.ref.toString())
      const redirect = await fetch(url, { redirect: 'manual' })
      expect(redirect.status).toBe(307)
      expect(redirect.headers.get('cache-control')).toBe('no-store')
      expect(redirect.headers.get('content-length')).not.toBe(
        String(smallFile.length),
      )
      expect(await redirect.text()).toBe('')
      expect(requests).toEqual(['HEAD'])
      const location = redirect.headers.get('location')
      assert(location)
      expect(new URL(location).searchParams.get('X-Amz-Expires')).toBe('60')

      const { body, headers } = await client.getBlob(
        alice,
        smallBlob.ref.toString(),
      )
      expect(uint8arrays.equals(smallFile, body)).toBeTruthy()
      expect(headers.get('content-type')).toBe('image/jpeg')
      expect(headers.get('content-disposition')).toBe(
        `attachment; filename="${smallBlob.ref}"`,
      )
      expect(requests).toEqual(['HEAD', 'HEAD', 'GET'])
    })

    it('checks blob metadata before asking S3 for a URL', async () => {
      const getDownloadUrl = jest.fn<S3BlobStore['getDownloadUrl']>()
      using _blobstore = jest
        .spyOn(ctx.actorStore.resources, 'blobstore')
        .mockImplementation((did) =>
          Object.assign(ctx.blobstore(did), { getDownloadUrl }),
        )
      await expect(
        client.getBlob(bob, smallBlob.ref.toString()),
      ).rejects.toThrow('Blob not found')
      expect(getDownloadUrl).not.toHaveBeenCalled()
    })

    it('does not issue a URL for a taken-down blob', async () => {
      const getDownloadUrl = jest.fn<S3BlobStore['getDownloadUrl']>()
      using _blobstore = jest
        .spyOn(ctx.actorStore.resources, 'blobstore')
        .mockImplementation((did) =>
          Object.assign(ctx.blobstore(did), { getDownloadUrl }),
        )
      await aliceDb.db
        .updateTable('blob')
        .set({ takedownRef: 'test' })
        .where('cid', '=', smallBlob.ref.toString())
        .execute()
      try {
        await expect(
          client.getBlob(alice, smallBlob.ref.toString()),
        ).rejects.toThrow('Blob not found')
        expect(getDownloadUrl).not.toHaveBeenCalled()
      } finally {
        await aliceDb.db
          .updateTable('blob')
          .set({ takedownRef: null })
          .where('cid', '=', smallBlob.ref.toString())
          .execute()
      }
    })
  })

  let largeBlob: TypedBlobRef
  let largeFile: Uint8Array<ArrayBuffer>

  it('does not allow referencing a file that is outside blob constraints', async () => {
    largeFile = await fs.readFile('../dev-env/assets/hd-key.jpg')
    const res = await client.uploadBlob(largeFile, {
      headers: sc.getHeaders(alice),
      encoding: 'image/jpeg',
    })
    assert(isTypedBlobRef(res.body.blob))
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
      .where('cid', '=', getBlobCidString(uploadAfterPermanent.blob))
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
    assert(isTypedBlobRef(uploaded.blob))
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
      .where('cid', '=', getBlobCidString(res.body.blob))
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
      .where('cid', '=', getBlobCidString(res.body.blob))
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
      .where('cid', '=', getBlobCidString(res.body.blob))
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
      .where('cid', '=', getBlobCidString(res.body.blob))
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
      .where('cid', '=', getBlobCidString(res.body.blob))
      .executeTakeFirst()

    expect(found?.mimeType).toBe('application/json')
  })
})
