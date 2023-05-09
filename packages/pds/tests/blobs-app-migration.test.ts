import AtpAgent, { BlobRef } from '@atproto/api'
import { runTestServer, TestServerInfo } from './_util'
import { Database } from '../src'
import DiskBlobStore from '../src/storage/disk-blobstore'
import { ids } from '../src/lexicon/lexicons'
import { ImageRef, SeedClient } from './seeds/client'
import { deleteDerefedBlobsMigration } from '../src/app-migrations/delete-derefed-blobs'

describe('blob deletes app migration', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let sc: SeedClient

  let blobstore: DiskBlobStore
  let db: Database

  let alice: string
  let bob: string

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'blobs_app_migration',
    })
    blobstore = server.ctx.blobstore as DiskBlobStore
    db = server.ctx.db
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    await sc.createAccount('bob', {
      email: 'bob@test.com',
      handle: 'bob.test',
      password: 'bob-pass',
    })
    alice = sc.dids.alice
    bob = sc.dids.bob
  })

  afterAll(async () => {
    await server.close()
  })

  let img1Alice: ImageRef
  let img2Alice: ImageRef
  let img3Alice: ImageRef
  let img4Alice: ImageRef
  let img5Alice: ImageRef
  let img5Bob: ImageRef

  it('does some setup', async () => {
    img1Alice = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    img2Alice = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    img3Alice = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-alt.jpg',
      'image/jpeg',
    )
    img4Alice = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-landscape-large.jpg',
      'image/jpeg',
    )
    img5Alice = await sc.uploadFile(
      alice,
      'tests/image/fixtures/at.png',
      'image/png',
    )
    img5Bob = await sc.uploadFile(
      bob,
      'tests/image/fixtures/at.png',
      'image/png',
    )
    // img1 is used by alice in post & profile & deleted
    const post1 = await sc.post(alice, 'post', undefined, [img1Alice])
    await updateProfile(sc, alice, img1Alice.image, img1Alice.image)
    await sc.deletePost(alice, post1.ref.uri)

    // img2 is used by alice in profile & deleted
    await updateProfile(sc, alice, img2Alice.image, img1Alice.image)

    // img3 is used by alice in profile & still used
    await updateProfile(sc, alice, img3Alice.image, undefined)
    // img4 is used by alice in post & still used
    await sc.post(alice, 'post', undefined, [img4Alice])

    // img5 is used by alice & bob, deleted for alice, but still used by bob
    const post5 = await sc.post(alice, 'post', undefined, [img5Alice])
    await updateProfile(sc, bob, img5Bob.image, undefined)
    await sc.deletePost(alice, post5.ref.uri)
  })

  it('runs migration', async () => {
    // const before = await db.db.selectFrom('blob').selectAll().execute()
    await deleteDerefedBlobsMigration(server.ctx)
    // const after = await db.db.selectFrom('blob').selectAll().execute()
    // console.log('before: ', before)
    // console.log('after: ', after)
  })

  const checkBlob = async (
    did: string,
    blob: ImageRef,
    checks: { repoBlob: number; dbBlob: boolean; blob: boolean },
  ) => {
    const cid = blob.image.ref
    const repoBlobRes = await db.db
      .selectFrom('repo_blob')
      .where('did', '=', did)
      .where('cid', '=', cid.toString())
      .execute()
    expect(repoBlobRes.length).toBe(checks.repoBlob)

    const dbBlobRes = await db.db
      .selectFrom('blob')
      .where('creator', '=', did)
      .where('cid', '=', cid.toString())
      .executeTakeFirst()
    const hasDbBlob = !!dbBlobRes
    expect(hasDbBlob).toEqual(checks.dbBlob)

    const hasBlob = await blobstore.hasStored(cid)
    expect(hasBlob).toEqual(checks.blob)
  }

  it('correctly deleted blobs', async () => {
    await checkBlob(alice, img1Alice, {
      repoBlob: 0,
      dbBlob: false,
      blob: false,
    })
    await checkBlob(alice, img2Alice, {
      repoBlob: 0,
      dbBlob: false,
      blob: false,
    })
    await checkBlob(alice, img3Alice, {
      repoBlob: 1,
      dbBlob: true,
      blob: true,
    })
    await checkBlob(alice, img4Alice, {
      repoBlob: 1,
      dbBlob: true,
      blob: true,
    })
    await checkBlob(alice, img5Alice, {
      repoBlob: 0,
      dbBlob: false,
      blob: true,
    })
    await checkBlob(bob, img5Bob, {
      repoBlob: 1,
      dbBlob: true,
      blob: true,
    })
  })
})

async function updateProfile(
  sc: SeedClient,
  did: string,
  avatar?: BlobRef,
  banner?: BlobRef,
) {
  return await sc.agent.api.com.atproto.repo.putRecord(
    {
      repo: did,
      collection: ids.AppBskyActorProfile,
      rkey: 'self',
      record: {
        avatar: avatar,
        banner: banner,
      },
    },
    { encoding: 'application/json', headers: sc.getHeaders(did) },
  )
}
