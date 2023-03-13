import { AtUri } from '@atproto/uri'
import { cidForCbor, TID } from '@atproto/common'
import { WriteOpAction } from '@atproto/repo'
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

  it('dedupes reposts', async () => {
    const subject = AtUri.make(did, lex.ids.AppBskyFeedPost, TID.nextStr())
    const subjectCid = await cidForCbor({ test: 'blah' })
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
        const cid = await cidForCbor(repost)
        await services
          .indexing(tx)
          .indexRecord(uri, cid, repost, WriteOpAction.Create, repost.createdAt)
        uris.push(uri)
      }
    })

    let count = await countRecords(db, 'repost')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.indexing(tx).deleteRecord(uris[0], false)
    })

    count = await countRecords(db, 'repost')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.indexing(tx).deleteRecord(uris[1], true)
    })

    count = await countRecords(db, 'repost')
    expect(count).toBe(0)
  })

  it('dedupes votes', async () => {
    const subject = AtUri.make(did, lex.ids.AppBskyFeedPost, TID.nextStr())
    const subjectCid = await cidForCbor({ test: 'blah' })
    const coll = lex.ids.AppBskyFeedVote
    const uris: AtUri[] = []
    await db.transaction(async (tx) => {
      for (let i = 0; i < 5; i++) {
        const direction = i % 2 === 0 ? 'up' : 'down'
        const vote = {
          $type: coll,
          subject: {
            uri: subject.toString(),
            cid: subjectCid.toString(),
          },
          direction,
          createdAt: new Date().toISOString(),
        }
        const uri = AtUri.make(did, coll, TID.nextStr())
        const cid = await cidForCbor(vote)
        await services
          .indexing(tx)
          .indexRecord(uri, cid, vote, WriteOpAction.Create, vote.createdAt)
        uris.push(uri)
      }
    })

    let count = await countRecords(db, 'vote')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.indexing(tx).deleteRecord(uris[0], false)
    })

    count = await countRecords(db, 'vote')
    expect(count).toBe(1)
    // since the first was deleted, the vote should be flipped to down now
    const got = await db.db
      .selectFrom('vote')
      .where('creator', '=', did)
      .selectAll()
      .executeTakeFirst()
    expect(got?.direction === 'down')

    await db.transaction(async (tx) => {
      await services.indexing(tx).deleteRecord(uris[1], true)
    })

    count = await countRecords(db, 'vote')
    expect(count).toBe(0)
  })

  it('dedupes follows', async () => {
    const subjectCid = await cidForCbor({ test: 'blah' })
    const coll = lex.ids.AppBskyGraphFollow
    const uris: AtUri[] = []
    await db.transaction(async (tx) => {
      for (let i = 0; i < 5; i++) {
        const follow = {
          $type: coll,
          subject: {
            did: 'did:example:bob',
            declarationCid: subjectCid.toString(),
          },
          createdAt: new Date().toISOString(),
        }
        const uri = AtUri.make(did, coll, TID.nextStr())
        const cid = await cidForCbor(follow)
        await services
          .indexing(tx)
          .indexRecord(uri, cid, follow, WriteOpAction.Create, follow.createdAt)
        uris.push(uri)
      }
    })

    let count = await countRecords(db, 'follow')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.indexing(tx).deleteRecord(uris[0], false)
    })

    count = await countRecords(db, 'follow')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.indexing(tx).deleteRecord(uris[1], true)
    })

    count = await countRecords(db, 'follow')
    expect(count).toBe(0)
  })
})
