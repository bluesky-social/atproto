import fs from 'fs/promises'
import { gzipSync } from 'zlib'
import AtpAgent from '@atproto/api'
import { CloseFn, runTestServer, TestServerInfo } from './_util'
import { Database, ServerConfig } from '../src'
import DiskBlobStore from '../src/storage/disk-blobstore'
import * as uint8arrays from 'uint8arrays'
import * as image from '../src/image'
import axios from 'axios'
import { randomBytes } from '@atproto/crypto'
import { BlobRef } from '@atproto/lexicon'
import { ids } from '../src/lexicon/lexicons'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'

describe('blob deletes', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let sc: SeedClient

  let bobAgent: AtpAgent
  let blobstore: DiskBlobStore
  let db: Database
  let cfg: ServerConfig
  let serverUrl: string

  let alice: string
  let bob: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'blob_deletes',
    })
    blobstore = server.ctx.blobstore as DiskBlobStore
    db = server.ctx.db
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await userSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    cfg = server.ctx.cfg
    serverUrl = server.url
  })

  afterAll(async () => {
    await server.close()
  })

  const getDbBlobsForDid = (did: string) => {
    return db.db
      .selectFrom('blob')
      .selectAll()
      .where('creator', '=', did)
      .execute()
  }

  it('deletes blob when record is deleted', async () => {
    const img = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    const post = await sc.post(alice, 'test', undefined, [img])
    await sc.deletePost(alice, post.ref.uri)

    const thing = await db.db
      .selectFrom('repo_blob')
      .selectAll()
      .where('did', '=', alice)
      .execute()

    console.log(thing)

    const dbBlobs = await getDbBlobsForDid(alice)
    expect(dbBlobs.length).toBe(0)

    const hasImg = await blobstore.hasStored(img.image.ref)
    expect(hasImg).toBeFalsy()
  })

  // it('can reference the file', async () => {
  //   await updateProfile(aliceAgent, {
  //     displayName: 'Alice',
  //     avatar: smallBlob,
  //   })
  // })

  // it('after being referenced, the file is moved to permanent storage', async () => {
  //   const found = await db.db
  //     .selectFrom('blob')
  //     .selectAll()
  //     .where('cid', '=', smallBlob.ref.toString())
  //     .executeTakeFirst()

  //   expect(found?.tempKey).toBeNull()
  //   expect(await blobstore.hasStored(smallBlob.ref)).toBeTruthy()
  //   const storedBytes = await blobstore.getBytes(smallBlob.ref)
  //   expect(uint8arrays.equals(smallFile, storedBytes)).toBeTruthy()
  // })

  // it('can fetch the file after being referenced', async () => {
  //   const { headers, data } = await aliceAgent.api.com.atproto.sync.getBlob({
  //     did: alice.did,
  //     cid: smallBlob.ref.toString(),
  //   })
  //   expect(headers['content-type']).toEqual('image/jpeg')
  //   expect(headers['content-security-policy']).toEqual(
  //     `default-src 'none'; sandbox`,
  //   )
  //   expect(headers['x-content-type-options']).toEqual('nosniff')
  //   expect(uint8arrays.equals(smallFile, new Uint8Array(data))).toBeTruthy()
  // })

  // it('serves the referenced blob', async () => {
  //   const profile = await aliceAgent.api.app.bsky.actor.getProfile({
  //     actor: 'alice.test',
  //   })
  //   const avatar = profile.data.avatar as string
  //   expect(typeof avatar).toBe('string')
  //   const url = avatar.replace(cfg.publicUrl, serverUrl)
  //   const res = await axios.get(url, { responseType: 'stream' })
  //   expect(res.headers['content-type']).toBe('image/jpeg')
  //   const info = await image.getInfo(res.data)
  //   expect(info).toEqual(
  //     expect.objectContaining({
  //       height: 1000,
  //       width: 1000,
  //     }),
  //   )
  // })

  // let largeBlob: BlobRef
  // let largeFile: Uint8Array

  // it('does not allow referencing a file that is outside blob constraints', async () => {
  //   largeFile = await fs.readFile('tests/image/fixtures/hd-key.jpg')
  //   const res = await aliceAgent.api.com.atproto.repo.uploadBlob(largeFile, {
  //     encoding: 'image/jpeg',
  //   })
  //   largeBlob = res.data.blob

  //   const profilePromise = updateProfile(aliceAgent, {
  //     avatar: largeBlob,
  //   })

  //   await expect(profilePromise).rejects.toThrow()
  // })

  // it('does not make a blob permanent if referencing failed', async () => {
  //   const found = await db.db
  //     .selectFrom('blob')
  //     .selectAll()
  //     .where('cid', '=', largeBlob.ref.toString())
  //     .executeTakeFirst()

  //   expect(found?.tempKey).toBeDefined()
  //   expect(await blobstore.hasTemp(found?.tempKey as string)).toBeTruthy()
  //   expect(await blobstore.hasStored(largeBlob.ref)).toBeFalsy()
  // })

  // it('permits duplicate uploads of the same file', async () => {
  //   const file = await fs.readFile(
  //     'tests/image/fixtures/key-landscape-small.jpg',
  //   )
  //   const { data: uploadA } = await aliceAgent.api.com.atproto.repo.uploadBlob(
  //     file,
  //     {
  //       encoding: 'image/jpeg',
  //     } as any,
  //   )
  //   const { data: uploadB } = await bobAgent.api.com.atproto.repo.uploadBlob(
  //     file,
  //     {
  //       encoding: 'image/jpeg',
  //     } as any,
  //   )
  //   expect(uploadA).toEqual(uploadB)

  //   await updateProfile(aliceAgent, {
  //     displayName: 'Alice',
  //     avatar: uploadA.blob,
  //   })
  //   const profileA = await aliceAgent.api.app.bsky.actor.profile.get({
  //     repo: alice.did,
  //     rkey: 'self',
  //   })
  //   expect((profileA.value as any).avatar.cid).toEqual(uploadA.cid)
  //   await updateProfile(bobAgent, {
  //     displayName: 'Bob',
  //     avatar: uploadB.blob,
  //   })
  //   const profileB = await bobAgent.api.app.bsky.actor.profile.get({
  //     repo: bob.did,
  //     rkey: 'self',
  //   })
  //   expect((profileB.value as any).avatar.cid).toEqual(uploadA.cid)
  //   const { data: uploadAfterPermanent } =
  //     await aliceAgent.api.com.atproto.repo.uploadBlob(file, {
  //       encoding: 'image/jpeg',
  //     } as any)
  //   expect(uploadAfterPermanent).toEqual(uploadA)
  //   const blob = await db.db
  //     .selectFrom('blob')
  //     .selectAll()
  //     .where('cid', '=', uploadAfterPermanent.blob.ref.toString())
  //     .executeTakeFirstOrThrow()
  //   expect(blob.tempKey).toEqual(null)
  // })

  // it('supports compression during upload', async () => {
  //   const { data: uploaded } = await aliceAgent.api.com.atproto.repo.uploadBlob(
  //     gzipSync(smallFile),
  //     {
  //       encoding: 'image/jpeg',
  //       headers: {
  //         'content-encoding': 'gzip',
  //       },
  //     } as any,
  //   )
  //   expect(uploaded.blob.ref.equals(smallBlob.ref)).toBeTruthy()
  // })

  // it('corrects a bad mimetype', async () => {
  //   const file = await fs.readFile(
  //     'tests/image/fixtures/key-landscape-large.jpg',
  //   )
  //   const res = await aliceAgent.api.com.atproto.repo.uploadBlob(file, {
  //     encoding: 'video/mp4',
  //   } as any)

  //   const found = await db.db
  //     .selectFrom('blob')
  //     .selectAll()
  //     .where('cid', '=', res.data.blob.ref.toString())
  //     .executeTakeFirst()

  //   expect(found?.mimeType).toBe('image/jpeg')
  //   expect(found?.width).toBe(1280)
  //   expect(found?.height).toBe(742)
  // })

  // it('handles pngs', async () => {
  //   const file = await fs.readFile('tests/image/fixtures/at.png')
  //   const res = await aliceAgent.api.com.atproto.repo.uploadBlob(file, {
  //     encoding: 'image/png',
  //   })

  //   const found = await db.db
  //     .selectFrom('blob')
  //     .selectAll()
  //     .where('cid', '=', res.data.blob.ref.toString())
  //     .executeTakeFirst()

  //   expect(found?.mimeType).toBe('image/png')
  //   expect(found?.width).toBe(554)
  //   expect(found?.height).toBe(532)
  // })

  // it('handles unknown mimetypes', async () => {
  //   const file = await randomBytes(20000)
  //   const res = await aliceAgent.api.com.atproto.repo.uploadBlob(file, {
  //     encoding: 'test/fake',
  //   } as any)

  //   const found = await db.db
  //     .selectFrom('blob')
  //     .selectAll()
  //     .where('cid', '=', res.data.blob.ref.toString())
  //     .executeTakeFirst()

  //   expect(found?.mimeType).toBe('test/fake')
  // })
})

async function updateProfile(agent: AtpAgent, record: Record<string, unknown>) {
  return await agent.api.com.atproto.repo.putRecord({
    repo: agent.session?.did ?? '',
    collection: ids.AppBskyActorProfile,
    rkey: 'self',
    record,
  })
}
