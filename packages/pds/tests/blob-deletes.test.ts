import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { BlobRef, Client } from '@atproto/lex'
import { DidString } from '@atproto/syntax'
import { AppContext, app, com } from '../src'

describe('blob deletes', () => {
  let network: TestNetworkNoAppView
  let client: Client
  let sc: SeedClient

  let ctx: AppContext

  let alice: DidString
  let bob: DidString

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'blob_deletes',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    client = network.pds.getClient()
    sc = network.getSeedClient()
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
    await network.close()
  })

  const getDbBlobsForDid = (did: string) => {
    return ctx.actorStore.read(did, (store) => store.repo.blob.getBlobCids())
  }

  it('deletes blob when record is deleted', async () => {
    const img = await sc.uploadFile(
      alice,
      '../dev-env/assets/key-portrait-small.jpg',
      'image/jpeg',
    )
    const post = await sc.post(alice, 'test', undefined, [img])
    await sc.deletePost(alice, post.ref.uri)
    await network.processAll()

    const dbBlobs = await getDbBlobsForDid(alice)
    expect(dbBlobs.length).toBe(0)

    const hasImg = await ctx.blobstore(alice).hasStored(img.image.ref)
    expect(hasImg).toBeFalsy()
  })

  it('deletes blob when blob-ref in record is updated', async () => {
    const img = await sc.uploadFile(
      alice,
      '../dev-env/assets/key-portrait-small.jpg',
      'image/jpeg',
    )
    const img2 = await sc.uploadFile(
      alice,
      '../dev-env/assets/key-landscape-small.jpg',
      'image/jpeg',
    )
    await updateProfile(sc, alice, img.image, img.image)
    await updateProfile(sc, alice, img2.image, img2.image)
    await network.processAll()

    const dbBlobs = await getDbBlobsForDid(alice)
    expect(dbBlobs.length).toBe(1)
    expect(dbBlobs[0].toString()).toEqual(img2.image.ref.toString())

    const hasImg = await ctx.blobstore(alice).hasStored(img.image.ref)
    expect(hasImg).toBeFalsy()

    const hasImg2 = await ctx.blobstore(alice).hasStored(img2.image.ref)
    expect(hasImg2).toBeTruthy()

    // reset
    await updateProfile(sc, alice)
  })

  it('does not delete blob when blob-ref in record is not updated', async () => {
    const img = await sc.uploadFile(
      alice,
      '../dev-env/assets/key-portrait-small.jpg',
      'image/jpeg',
    )
    const img2 = await sc.uploadFile(
      alice,
      '../dev-env/assets/key-landscape-small.jpg',
      'image/jpeg',
    )
    await updateProfile(sc, alice, img.image, img.image)
    await updateProfile(sc, alice, img.image, img2.image)
    await network.processAll()

    const dbBlobs = await getDbBlobsForDid(alice)
    expect(dbBlobs.length).toBe(2)

    const hasImg = await ctx.blobstore(alice).hasStored(img.image.ref)
    expect(hasImg).toBeTruthy()

    const hasImg2 = await ctx.blobstore(alice).hasStored(img2.image.ref)
    expect(hasImg2).toBeTruthy()
    await updateProfile(sc, alice)
  })

  it('does not delete blob when blob is reused by another record in same commit', async () => {
    const img = await sc.uploadFile(
      alice,
      '../dev-env/assets/key-portrait-small.jpg',
      'image/jpeg',
    )
    const post = await sc.post(alice, 'post', undefined, [img])

    await client.call(
      com.atproto.repo.applyWrites,
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
      { headers: sc.getHeaders(alice) },
    )
    await network.processAll()

    const dbBlobs = await getDbBlobsForDid(alice)
    expect(dbBlobs.length).toBe(1)

    const hasImg = await ctx.blobstore(alice).hasStored(img.image.ref)
    expect(hasImg).toBeTruthy()
  })

  it('does delete blob from user blob store if another user is using it', async () => {
    const imgAlice = await sc.uploadFile(
      alice,
      '../dev-env/assets/key-landscape-small.jpg',
      'image/jpeg',
    )
    const imgBob = await sc.uploadFile(
      bob,
      '../dev-env/assets/key-landscape-small.jpg',
      'image/jpeg',
    )
    const postAlice = await sc.post(alice, 'post', undefined, [imgAlice])
    await sc.post(bob, 'post', undefined, [imgBob])
    await sc.deletePost(alice, postAlice.ref.uri)
    await network.processAll()

    const hasImg = await ctx.blobstore(alice).hasStored(imgAlice.image.ref)
    expect(hasImg).toBeFalsy()
  })
})

async function updateProfile(
  sc: SeedClient,
  did: DidString,
  avatar?: BlobRef,
  banner?: BlobRef,
) {
  return await sc.client.put(
    app.bsky.actor.profile,
    {
      avatar: avatar,
      banner: banner,
    },
    {
      repo: did,
      rkey: 'self',
      headers: sc.getHeaders(did),
    },
  )
}
