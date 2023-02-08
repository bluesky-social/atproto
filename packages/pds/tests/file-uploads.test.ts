import fs from 'fs/promises'
import { gzipSync } from 'zlib'
import AtpAgent from '@atproto/api'
import { CloseFn, runTestServer, TestServerInfo } from './_util'
import { CID } from 'multiformats/cid'
import { Database, ServerConfig } from '../src'
import DiskBlobStore from '../src/storage/disk-blobstore'
import * as uint8arrays from 'uint8arrays'
import * as image from '../src/image'
import axios from 'axios'
import { randomBytes } from '@atproto/crypto'

const alice = {
  email: 'alice@test.com',
  handle: 'alice.test',
  did: '',
  password: 'alice-pass',
}
const bob = {
  email: 'bob@test.com',
  handle: 'bob.test',
  did: '',
  password: 'bob-pass',
}

describe('file uploads', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let aliceAgent: AtpAgent
  let bobAgent: AtpAgent
  let blobstore: DiskBlobStore
  let db: Database
  let cfg: ServerConfig
  let serverUrl: string
  let close: CloseFn

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'file_uploads',
    })
    blobstore = server.ctx.blobstore as DiskBlobStore
    db = server.ctx.db
    close = server.close
    agent = new AtpAgent({ service: server.url })
    aliceAgent = new AtpAgent({ service: server.url })
    bobAgent = new AtpAgent({ service: server.url })
    cfg = server.ctx.cfg
    serverUrl = server.url
  })

  afterAll(async () => {
    await close()
  })

  it('registers users', async () => {
    const res = await agent.api.com.atproto.account.create({
      email: alice.email,
      handle: alice.handle,
      password: alice.password,
    })
    aliceAgent.api.setHeader('authorization', `Bearer ${res.data.accessJwt}`)
    alice.did = res.data.did
    const res2 = await agent.api.com.atproto.account.create({
      email: bob.email,
      handle: bob.handle,
      password: bob.password,
    })
    bobAgent.api.setHeader('authorization', `Bearer ${res2.data.accessJwt}`)
    bob.did = res2.data.did
  })

  let smallCid: CID
  let smallFile: Uint8Array

  it('handles client abort', async () => {
    const abortController = new AbortController()
    const _putTemp = server.ctx.blobstore.putTemp
    server.ctx.blobstore.putTemp = function (...args) {
      // Abort just as processing blob in packages/pds/src/services/repo/blobs.ts
      process.nextTick(() => abortController.abort())
      return _putTemp.call(this, ...args)
    }
    const response = fetch(`${server.url}/xrpc/com.atproto.blob.upload`, {
      method: 'post',
      body: Buffer.alloc(5000000), // Enough bytes to get some chunking going on
      signal: abortController.signal,
      headers: {
        'content-type': 'image/jpeg',
        authorization: aliceAgent.api.xrpc.headers.authorization,
      },
    })
    await expect(response).rejects.toThrow('operation was aborted')
    // Cleanup
    server.ctx.blobstore.putTemp = _putTemp
    // This test would fail from an uncaught exception: this grace period gives time for that to surface
    await new Promise((res) => setTimeout(res, 10))
  })

  it('uploads files', async () => {
    smallFile = await fs.readFile('tests/image/fixtures/key-portrait-small.jpg')
    const res = await aliceAgent.api.com.atproto.blob.upload(smallFile, {
      encoding: 'image/jpeg',
    } as any)
    smallCid = CID.parse(res.data.cid)

    const found = await db.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', smallCid.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('image/jpeg')
    expect(found?.size).toBe(smallFile.length)
    expect(found?.tempKey).toBeDefined()
    expect(found?.width).toBe(87)
    expect(found?.height).toBe(150)
    expect(await blobstore.hasTemp(found?.tempKey as string)).toBeTruthy()
  })

  it('can reference the file', async () => {
    await aliceAgent.api.app.bsky.actor.updateProfile({
      displayName: 'Alice',
      avatar: { cid: smallCid.toString(), mimeType: 'image/jpeg' },
    })
  })

  it('after being referenced, the file is moved to permanent storage', async () => {
    const found = await db.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', smallCid.toString())
      .executeTakeFirst()

    expect(found?.tempKey).toBeNull()
    expect(await blobstore.hasStored(smallCid)).toBeTruthy()
    const storedBytes = await blobstore.getBytes(smallCid)
    expect(uint8arrays.equals(smallFile, storedBytes)).toBeTruthy()
  })

  it('serves the referenced blob', async () => {
    const profile = await aliceAgent.api.app.bsky.actor.getProfile({
      actor: 'alice.test',
    })
    const avatar = profile.data.avatar as string
    expect(typeof avatar).toBe('string')
    const url = avatar.replace(cfg.publicUrl, serverUrl)
    const res = await axios.get(url, { responseType: 'stream' })
    expect(res.headers['content-type']).toBe('image/jpeg')
    const info = await image.getInfo(res.data)
    expect(info).toEqual(
      expect.objectContaining({
        height: 1000,
        width: 1000,
      }),
    )
  })

  let largeCid: CID
  let largeFile: Uint8Array

  it('does not allow referencing a file that is outside blob constraints', async () => {
    largeFile = await fs.readFile('tests/image/fixtures/hd-key.jpg')
    const res = await aliceAgent.api.com.atproto.blob.upload(largeFile, {
      encoding: 'image/jpeg',
    } as any)
    largeCid = CID.parse(res.data.cid)

    const profilePromise = aliceAgent.api.app.bsky.actor.updateProfile({
      avatar: { cid: largeCid.toString(), mimeType: 'image/jpeg' },
    })

    await expect(profilePromise).rejects.toThrow()
  })

  it('does not make a blob permanent if referencing failed', async () => {
    const found = await db.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', largeCid.toString())
      .executeTakeFirst()

    expect(found?.tempKey).toBeDefined()
    expect(await blobstore.hasTemp(found?.tempKey as string)).toBeTruthy()
    expect(await blobstore.hasStored(largeCid)).toBeFalsy()
  })

  it('permits duplicate uploads of the same file', async () => {
    const file = await fs.readFile(
      'tests/image/fixtures/key-landscape-small.jpg',
    )
    const { data: uploadA } = await aliceAgent.api.com.atproto.blob.upload(
      file,
      {
        encoding: 'image/jpeg',
      } as any,
    )
    const { data: uploadB } = await bobAgent.api.com.atproto.blob.upload(file, {
      encoding: 'image/jpeg',
    } as any)
    expect(uploadA).toEqual(uploadB)
    const { data: profileA } =
      await aliceAgent.api.app.bsky.actor.updateProfile({
        displayName: 'Alice',
        avatar: { cid: uploadA.cid, mimeType: 'image/jpeg' },
      })
    expect((profileA.record as any).avatar.cid).toEqual(uploadA.cid)
    const { data: profileB } = await bobAgent.api.app.bsky.actor.updateProfile({
      displayName: 'Bob',
      avatar: { cid: uploadB.cid, mimeType: 'image/jpeg' },
    })
    expect((profileB.record as any).avatar.cid).toEqual(uploadA.cid)
    const { data: uploadAfterPermanent } =
      await aliceAgent.api.com.atproto.blob.upload(file, {
        encoding: 'image/jpeg',
      } as any)
    expect(uploadAfterPermanent).toEqual(uploadA)
    const blob = await db.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', uploadAfterPermanent.cid)
      .executeTakeFirstOrThrow()
    expect(blob.tempKey).toEqual(null)
  })

  it('supports compression during upload', async () => {
    const { data: uploaded } = await aliceAgent.api.com.atproto.blob.upload(
      gzipSync(smallFile),
      {
        encoding: 'image/jpeg',
        headers: {
          'content-encoding': 'gzip',
        },
      } as any,
    )
    expect(uploaded.cid).toEqual(smallCid.toString())
  })

  it('corrects a bad mimetype', async () => {
    const file = await fs.readFile(
      'tests/image/fixtures/key-landscape-large.jpg',
    )
    const res = await aliceAgent.api.com.atproto.blob.upload(file, {
      encoding: 'video/mp4',
    } as any)

    const found = await db.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', res.data.cid.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('image/jpeg')
    expect(found?.width).toBe(1280)
    expect(found?.height).toBe(742)
  })

  it('handles unknown mimetypes', async () => {
    const file = await randomBytes(20000)
    const res = await aliceAgent.api.com.atproto.blob.upload(file, {
      encoding: 'test/fake',
    } as any)

    const found = await db.db
      .selectFrom('blob')
      .selectAll()
      .where('cid', '=', res.data.cid.toString())
      .executeTakeFirst()

    expect(found?.mimeType).toBe('test/fake')
  })
})
