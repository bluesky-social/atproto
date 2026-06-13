import { ids } from '../../src/data-plane/server/indexing/collections'
import { createIndexingService, createTestDb, indexCreate } from './helpers'

const alice = 'did:plc:alice'
const bob = 'did:plc:bob'
const ts = '2026-01-01T00:00:00.000Z'

describe('duplicate records', () => {
  const schema = 'sokaa_appview_dupes'
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

  it('dedupes follows by creator + subjectDid', async () => {
    await indexCreate(svc, {
      did: alice,
      collection: ids.AppSokaaGraphFollow,
      rkey: '3jzfcijpj2z2f',
      timestamp: ts,
      record: {
        $type: ids.AppSokaaGraphFollow,
        subject: bob,
        createdAt: ts,
      },
    })
    await indexCreate(svc, {
      did: alice,
      collection: ids.AppSokaaGraphFollow,
      rkey: '3jzfcijpj2z2g',
      timestamp: ts,
      record: {
        $type: ids.AppSokaaGraphFollow,
        subject: bob,
        createdAt: ts,
      },
    })

    const follows = await database.db
      .selectFrom('follow')
      .where('creator', '=', alice)
      .selectAll()
      .execute()
    expect(follows).toHaveLength(1)
  })

  it('dedupes likes by creator + subject', async () => {
    const postUri = `at://${bob}/${ids.AppSokaaFeedPost}/3jzfcijpj2z2h`

    await indexCreate(svc, {
      did: alice,
      collection: ids.AppSokaaFeedLike,
      rkey: '3jzfcijpj2z2i',
      timestamp: ts,
      record: {
        $type: ids.AppSokaaFeedLike,
        subject: {
          uri: postUri,
          cid: 'bafyreief577qr2nxcsmx5gi536ftridv6p7zfkd4w2oacyl5xvzqzp36fy',
        },
        createdAt: ts,
      },
    })
    await indexCreate(svc, {
      did: alice,
      collection: ids.AppSokaaFeedLike,
      rkey: '3jzfcijpj2z2j',
      timestamp: ts,
      record: {
        $type: ids.AppSokaaFeedLike,
        subject: {
          uri: postUri,
          cid: 'bafyreief577qr2nxcsmx5gi536ftridv6p7zfkd4w2oacyl5xvzqzp36fy',
        },
        createdAt: ts,
      },
    })

    const likes = await database.db
      .selectFrom('like')
      .where('creator', '=', alice)
      .selectAll()
      .execute()
    expect(likes).toHaveLength(1)
  })
})
