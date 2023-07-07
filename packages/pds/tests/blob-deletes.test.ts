import AtpAgent, { BlobRef } from '@atproto/api'
import { runTestServer, TestServerInfo } from './_util'
import { Database } from '../src'
import DiskBlobStore from '../src/storage/disk-blobstore'
import { ids } from '../src/lexicon/lexicons'
import { SeedClient } from './seeds/client'

describe('blob deletes', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let sc: SeedClient

  let blobstore: DiskBlobStore
  let db: Database

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
    await server.processAll()

    const dbBlobs = await getDbBlobsForDid(alice)
    expect(dbBlobs.length).toBe(0)

    const hasImg = await blobstore.hasStored(img.image.ref)
    expect(hasImg).toBeFalsy()
  })

  it('deletes blob when blob-ref in record is updated', async () => {
    const img = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    const img2 = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    await updateProfile(sc, alice, img.image, img.image)
    await updateProfile(sc, alice, img2.image, img2.image)
    await server.processAll()

    const dbBlobs = await getDbBlobsForDid(alice)
    expect(dbBlobs.length).toBe(1)
    expect(dbBlobs[0].cid).toEqual(img2.image.ref.toString())

    const hasImg = await blobstore.hasStored(img.image.ref)
    expect(hasImg).toBeFalsy()

    const hasImg2 = await blobstore.hasStored(img2.image.ref)
    expect(hasImg2).toBeTruthy()

    // reset
    await updateProfile(sc, alice)
  })

  it('does not delete blob when blob-ref in record is not updated', async () => {
    const img = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    const img2 = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    await updateProfile(sc, alice, img.image, img.image)
    await updateProfile(sc, alice, img.image, img2.image)
    await server.processAll()

    const dbBlobs = await getDbBlobsForDid(alice)
    expect(dbBlobs.length).toBe(2)

    const hasImg = await blobstore.hasStored(img.image.ref)
    expect(hasImg).toBeTruthy()

    const hasImg2 = await blobstore.hasStored(img2.image.ref)
    expect(hasImg2).toBeTruthy()
    await updateProfile(sc, alice)
  })

  it('does not delete blob when blob is reused by another record in same commit', async () => {
    const img = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    const post = await sc.post(alice, 'post', undefined, [img])

    await agent.com.atproto.repo.applyWrites(
      {
        repo: alice,
        writes: [
          {
            $type: 'com.atproto.repo.applyWrites#delete',
            collection: 'app.bsky.feed.post',
            rkey: post.ref.uri.rkey,
          },
          {
            $type: 'com.atproto.repo.applyWrites#create',
            collection: 'app.bsky.feed.post',
            value: {
              text: 'post2',
              embed: {
                $type: 'app.bsky.embed.images',
                images: [
                  {
                    image: img.image,
                    alt: 'alt',
                  },
                ],
              },
              createdAt: new Date().toISOString(),
            },
          },
        ],
      },
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
    await server.processAll()

    const dbBlobs = await getDbBlobsForDid(alice)
    expect(dbBlobs.length).toBe(1)

    const hasImg = await blobstore.hasStored(img.image.ref)
    expect(hasImg).toBeTruthy()
  })

  it('does not delete blob from blob store if another user is using it', async () => {
    const imgAlice = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    const imgBob = await sc.uploadFile(
      bob,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    const postAlice = await sc.post(alice, 'post', undefined, [imgAlice])
    await sc.post(bob, 'post', undefined, [imgBob])
    await sc.deletePost(alice, postAlice.ref.uri)

    const hasImg = await blobstore.hasStored(imgBob.image.ref)
    expect(hasImg).toBeTruthy()
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
