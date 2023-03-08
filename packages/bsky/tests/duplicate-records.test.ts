import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { cidForCbor, TID, cborEncode } from '@atproto/common'
import { CloseFn, runTestServer } from './_util'
import { Database } from '../src'
import * as lex from '../src/lexicon/lexicons'
import { APP_BSKY_GRAPH } from '../src/lexicon'
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

  it('dedupes votes', async () => {
    const subject = AtUri.make(did, lex.ids.AppBskyFeedPost, TID.nextStr())
    const subjectCid = await putBlock(db, did, { test: 'blah' })
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
        const cid = await putBlock(tx, did, vote)
        await services.record(tx).indexRecord(uri, cid, vote)
        uris.push(uri)
      }
    })

    let count = await countRecords(db, 'vote')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(uris[0], false)
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
      await services.record(tx).deleteRecord(uris[1], true)
    })

    count = await countRecords(db, 'vote')
    expect(count).toBe(0)
  })

  it('dedupes follows', async () => {
    const subjectCid = await putBlock(db, did, { test: 'blah' })
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

  it('dedupes assertions & confirmations', async () => {
    const subjectCid = await putBlock(db, did, { test: 'blah' })
    const assertUris: AtUri[] = []
    const assertCids: CID[] = []
    // make assertions
    await db.transaction(async (tx) => {
      const coll = lex.ids.AppBskyGraphAssertion
      for (let i = 0; i < 5; i++) {
        const assertion = {
          $type: coll,
          assertion: APP_BSKY_GRAPH.AssertMember,
          subject: {
            did: 'did:example:bob',
            declarationCid: subjectCid.toString(),
          },
          createdAt: new Date().toISOString(),
        }
        const uri = AtUri.make(did, coll, TID.nextStr())
        const cid = await putBlock(tx, did, assertion)
        await services.record(tx).indexRecord(uri, cid, assertion)
        assertUris.push(uri)
        assertCids.push(cid)
      }
    })
    const confirmUris: AtUri[] = []
    const confirmCids: CID[] = []
    // make confirms on first assert
    await db.transaction(async (tx) => {
      const coll = lex.ids.AppBskyGraphConfirmation
      for (let i = 0; i < 5; i++) {
        const follow = {
          $type: coll,
          originator: {
            did: 'did:example:bob',
            declarationCid: subjectCid.toString(),
          },
          assertion: {
            uri: assertUris[0].toString(),
            cid: assertCids[0].toString(),
          },
          createdAt: new Date().toISOString(),
        }
        const uri = AtUri.make(did, coll, TID.nextStr())
        const cid = await putBlock(tx, did, follow)
        await services.record(tx).indexRecord(uri, cid, follow)
        confirmUris.push(uri)
        confirmCids.push(cid)
      }
    })

    const getAssertion = async () => {
      return await db.db
        .selectFrom('assertion')
        .selectAll()
        .where('creator', '=', did)
        .executeTakeFirst()
    }

    let count = await countRecords(db, 'assertion')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(confirmUris[0], false)
    })

    count = await countRecords(db, 'assertion')
    expect(count).toBe(1)
    let assertion = await getAssertion()
    expect(assertion?.confirmUri).toEqual(confirmUris[1].toString())

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(confirmUris[1], true)
    })

    count = await countRecords(db, 'assertion')
    expect(count).toBe(1)
    assertion = await getAssertion()
    expect(assertion?.confirmUri).toBeNull()

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(assertUris[0], false)
    })

    count = await countRecords(db, 'assertion')
    expect(count).toBe(1)

    await db.transaction(async (tx) => {
      await services.record(tx).deleteRecord(assertUris[1], false)
    })

    count = await countRecords(db, 'assertion')
    expect(count).toBe(0)
  })
})
