import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import * as Post from '../src/lexicon/types/app/bsky/feed/post'
import { AtUri } from '@atproto/uri'
import { SeedClient } from './seeds/client'
import { CloseFn, paginateAll, runTestServer } from './_util'
import { Database } from '../src'
import { ServiceClient } from '@atproto/xrpc'
import * as schemas from '../src/db/schemas'
import { cidForData, TID } from '@atproto/common'

describe('duplicate record', () => {
  let close: CloseFn
  let client: AtpServiceClient
  let did: string
  let db: Database

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'duplicates',
    })
    db = server.db
    close = server.close
    client = AtpApi.service(server.url)
    const res = await client.com.atproto.account.create({
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice-pass',
    })
    client.setHeader('authorization', `Bearer ${res.data.accessJwt}`)
    did = res.data.did
  })

  afterAll(async () => {
    await close()
  })

  const countRecords = async (table: string) => {
    const got = await db.db
      .selectFrom(table as any)
      .selectAll()
      .where('creator', '=', did)
      .execute()
    return got.length
  }

  it('dedupes reposts', async () => {
    const subject = AtUri.make(did, schemas.ids.AppBskyFeedPost, TID.nextStr())
    const subjectCid = await cidForData('blah')
    const coll = schemas.ids.AppBskyFeedRepost
    const uris: AtUri[] = []
    await db.transaction(async (tx) => {
      for (let i = 0; i < 5; i++) {
        const repost = {
          $type: coll,
          subject: {
            uri: subject.toString(),
            cid: subjectCid.toString(),
          },
          createdAt: new Date().toISOString(),
        }
        const uri = AtUri.make(did, coll, TID.nextStr())
        const cid = await cidForData(repost)
        await tx.indexRecord(uri, cid, repost)
        uris.push(uri)
      }
    })

    let count = await countRecords('repost')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await tx.deleteRecord(uris[0], false)
    })

    count = await countRecords('repost')
    // expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await tx.deleteRecord(uris[1], true)
    })

    count = await countRecords('repost')
    expect(count).toBe(0)
  })
})
