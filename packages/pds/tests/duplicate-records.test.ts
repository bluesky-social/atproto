import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { cidForCbor, TID, cborEncode } from '@atproto/common'
import { CloseFn, runTestServer } from './_util'
import { Database } from '../src'
import * as lex from '../src/lexicon/lexicons'
import { Services } from '../src/services'

describe('duplicate record', () => {
  let close: CloseFn
  let did: string
  let db: Database
  let services: Services

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'duplicates',
    })
    db = server.ctx.db
    services = server.ctx.services
    close = server.close
    did = 'did:example:alice'
  })

  afterAll(async () => {
    await close()
  })

  const countRecords = async (db: Database, table: string) => {
    const got = await db.db
      .selectFrom(table as any)
      .selectAll()
      .where('creator', '=', did)
      .execute()
    return got.length
  }

  const putBlock = async (
    db: Database,
    creator: string,
    data: object,
  ): Promise<CID> => {
    const cid = await cidForCbor(data)
    const bytes = await cborEncode(data)
    await db.db
      .insertInto('ipld_block')
      .values({
        cid: cid.toString(),
        creator,
        size: bytes.length,
        content: bytes,
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
    return cid
  }

  it('dedupes reposts', async () => {
    const subject = AtUri.make(did, lex.ids.AppBskyFeedPost, TID.nextStr())
    const subjectCid = await putBlock(db, did, { test: 'blah' })
    const coll = lex.ids.AppBskyFeedRepost
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
        const cid = await putBlock(tx, did, repost)
        await services.record(tx).indexRecord(uri, cid, repost)
        uris.push(uri)
      }
    })

    let count = await countRecords(db, 'repost')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(uris[0], false)
    })

    count = await countRecords(db, 'repost')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(uris[1], true)
    })

    count = await countRecords(db, 'repost')
    expect(count).toBe(0)
  })

  it('dedupes likes', async () => {
    const subject = AtUri.make(did, lex.ids.AppBskyFeedPost, TID.nextStr())
    const subjectCid = await putBlock(db, did, { test: 'blah' })
    const coll = lex.ids.AppBskyFeedLike
    const uris: AtUri[] = []
    await db.transaction(async (tx) => {
      for (let i = 0; i < 5; i++) {
        const like = {
          $type: coll,
          subject: {
            uri: subject.toString(),
            cid: subjectCid.toString(),
          },
          createdAt: new Date().toISOString(),
        }
        const uri = AtUri.make(did, coll, TID.nextStr())
        const cid = await putBlock(tx, did, like)
        await services.record(tx).indexRecord(uri, cid, like)
        uris.push(uri)
      }
    })

    let count = await countRecords(db, 'like')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(uris[0], false)
    })

    count = await countRecords(db, 'like')
    expect(count).toBe(1)

    const got = await db.db
      .selectFrom('like')
      .where('creator', '=', did)
      .selectAll()
      .executeTakeFirst()
    expect(got?.uri).toEqual(uris[1].toString())

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(uris[1], true)
    })

    count = await countRecords(db, 'like')
    expect(count).toBe(0)
  })

  it('dedupes follows', async () => {
    const coll = lex.ids.AppBskyGraphFollow
    const uris: AtUri[] = []
    await db.transaction(async (tx) => {
      for (let i = 0; i < 5; i++) {
        const follow = {
          $type: coll,
          subject: 'did:example:bob',
          createdAt: new Date().toISOString(),
        }
        const uri = AtUri.make(did, coll, TID.nextStr())
        const cid = await putBlock(tx, did, follow)
        await services.record(tx).indexRecord(uri, cid, follow)
        uris.push(uri)
      }
    })

    let count = await countRecords(db, 'follow')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(uris[0], false)
    })

    count = await countRecords(db, 'follow')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(uris[1], true)
    })

    count = await countRecords(db, 'follow')
    expect(count).toBe(0)
  })
})
