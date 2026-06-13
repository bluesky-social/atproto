import { CID } from 'multiformats/cid'
import { BlobRef } from '@atproto/lexicon'
import { ids } from '../../src/data-plane/server/indexing/collections'
import {
  createIndexingService,
  createTestDb,
  indexCreate,
  indexDelete,
} from './helpers'

const alice = 'did:plc:alice'
const bob = 'did:plc:bob'
const carol = 'did:plc:carol'
const ts = '2026-01-01T00:00:00.000Z'
const blobCid = CID.parse(
  'bafyreief577qr2nxcsmx5gi536ftridv6p7zfkd4w2oacyl5xvzqzp36fy',
)

describe('indexing', () => {
  const schema = 'sokaa_appview_indexing'
  let database: Awaited<ReturnType<typeof createTestDb>>
  let svc: ReturnType<typeof createIndexingService>

  beforeAll(async () => {
    database = await createTestDb(schema)
    svc = createIndexingService(database)
  })

  afterAll(async () => {
    await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.close()
  })

  it('indexes a video post with sanitized caption', async () => {
    const { uri } = await indexCreate(svc, {
      did: alice,
      collection: ids.AppSokaaFeedPost,
      rkey: '3jzfcijpj2z2a',
      timestamp: ts,
      record: {
        $type: ids.AppSokaaFeedPost,
        caption: 'hello\0world',
        media: {
          $type: ids.AppSokaaEmbedVideo,
          video: new BlobRef(blobCid, 'video/mp4', 1024),
        },
        createdAt: ts,
      },
    })

    const post = await database.db
      .selectFrom('post')
      .where('uri', '=', uri.toString())
      .selectAll()
      .executeTakeFirst()
    expect(post?.caption).toBe('helloworld')
    expect(post?.mediaType).toBe('video')
    expect(post?.likeCount).toBe(0)

    const actor = await database.db
      .selectFrom('actor')
      .where('did', '=', alice)
      .selectAll()
      .executeTakeFirst()
    expect(actor?.postsCount).toBe(1)
  })

  it('indexes a like and updates post likeCount', async () => {
    const postUri = `at://${bob}/${ids.AppSokaaFeedPost}/3jzfcijpj2z2b`
    await indexCreate(svc, {
      did: bob,
      collection: ids.AppSokaaFeedPost,
      rkey: '3jzfcijpj2z2b',
      timestamp: ts,
      record: {
        $type: ids.AppSokaaFeedPost,
        media: {
          $type: ids.AppSokaaEmbedVideo,
          video: new BlobRef(blobCid, 'video/mp4', 1024),
        },
        createdAt: ts,
      },
    })

    await indexCreate(svc, {
      did: alice,
      collection: ids.AppSokaaFeedLike,
      rkey: '3jzfcijpj2z2c',
      timestamp: ts,
      record: {
        $type: ids.AppSokaaFeedLike,
        subject: { uri: postUri, cid: blobCid.toString() },
        createdAt: ts,
      },
    })

    const post = await database.db
      .selectFrom('post')
      .where('uri', '=', postUri)
      .selectAll()
      .executeTakeFirst()
    expect(post?.likeCount).toBe(1)
  })

  it('indexes a follow and updates followersCount', async () => {
    await indexCreate(svc, {
      did: alice,
      collection: ids.AppSokaaGraphFollow,
      rkey: '3jzfcijpj2z2d',
      timestamp: ts,
      record: {
        $type: ids.AppSokaaGraphFollow,
        subject: bob,
        createdAt: ts,
      },
    })

    const actor = await database.db
      .selectFrom('actor')
      .where('did', '=', bob)
      .selectAll()
      .executeTakeFirst()
    expect(actor?.followersCount).toBe(1)
  })

  it('indexes a profile into the actor row', async () => {
    await indexCreate(svc, {
      did: alice,
      collection: ids.AppSokaaActorProfile,
      rkey: 'self',
      timestamp: ts,
      record: {
        $type: ids.AppSokaaActorProfile,
        displayName: 'Alice\0Test',
        description: 'bio',
        createdAt: ts,
      },
    })

    const actor = await database.db
      .selectFrom('actor')
      .where('did', '=', alice)
      .selectAll()
      .executeTakeFirst()
    expect(actor?.displayName).toBe('AliceTest')
    expect(actor?.description).toBe('bio')
  })

  it('deletes a post and updates postsCount', async () => {
    const { uri } = await indexCreate(svc, {
      did: carol,
      collection: ids.AppSokaaFeedPost,
      rkey: '3jzfcijpj2z2e',
      timestamp: ts,
      record: {
        $type: ids.AppSokaaFeedPost,
        media: {
          $type: ids.AppSokaaEmbedVideo,
          video: new BlobRef(blobCid, 'video/mp4', 1024),
        },
        createdAt: ts,
      },
    })

    await indexDelete(svc, uri)

    const post = await database.db
      .selectFrom('post')
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    expect(post).toBeUndefined()

    const actor = await database.db
      .selectFrom('actor')
      .where('did', '=', carol)
      .selectAll()
      .executeTakeFirst()
    expect(actor?.postsCount).toBe(0)
  })
})
