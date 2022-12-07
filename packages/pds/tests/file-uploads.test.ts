import fs from 'fs/promises'
import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { CloseFn, runTestServer } from './_util'
import { CID } from 'multiformats/cid'
import { Database } from '../src'
import DiskBlobStore from '../src/storage/disk-blobstore'
import * as uint8arrays from 'uint8arrays'

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
  let client: AtpServiceClient
  let aliceClient: AtpServiceClient
  let blobstore: DiskBlobStore
  let db: Database
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'file-uploads',
    })
    blobstore = server.blobstore as DiskBlobStore
    db = server.db
    close = server.close
    client = AtpApi.service(server.url)
    aliceClient = AtpApi.service(server.url)
  })

  afterAll(async () => {
    await close()
  })

  it('registers users', async () => {
    const res = await client.com.atproto.account.create({
      email: alice.email,
      handle: alice.handle,
      password: alice.password,
    })
    aliceClient.setHeader('authorization', `Bearer ${res.data.accessJwt}`)
    alice.did = res.data.did
    const res2 = await client.com.atproto.account.create({
      email: bob.email,
      handle: bob.handle,
      password: bob.password,
    })
    bob.did = res2.data.did
  })

  let smallCid: CID
  let smallFile: Uint8Array

  it('uploads files', async () => {
    smallFile = await fs.readFile('tests/image/fixtures/key-portrait-small.jpg')
    const res = await aliceClient.com.atproto.data.uploadFile(smallFile, {
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
    await aliceClient.app.bsky.actor.updateProfile({
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

  let largeCid: CID
  let largeFile: Uint8Array

  it('does not allow referencing a file that is outside blob constraints', async () => {
    largeFile = await fs.readFile('tests/image/fixtures/key-portrait-large.jpg')
    const res = await aliceClient.com.atproto.data.uploadFile(largeFile, {
      encoding: 'image/jpeg',
    } as any)
    largeCid = CID.parse(res.data.cid)

    const profilePromise = aliceClient.app.bsky.actor.updateProfile({
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
})
