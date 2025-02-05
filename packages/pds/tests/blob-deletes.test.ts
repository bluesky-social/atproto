import { AtpAgent, BlobRef } from '@atproto/api'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { AppContext } from '../src'
import { ids } from '../src/lexicon/lexicons'

describe('blob deletes', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  let ctx: AppContext

  let alice: string
  let bob: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'blob_deletes',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    agent = network.pds.getClient()
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
