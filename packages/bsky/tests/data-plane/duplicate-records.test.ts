import { TID, cidForCbor } from '@atproto/common'
import { TestNetwork } from '@atproto/dev-env'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import * as lex from '../../src/lexicon/lexicons'

type Database = TestNetwork['bsky']['db']

describe('duplicate record', () => {
  let network: TestNetwork
  let did: string
  let db: Database

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_duplicates',
    })
    db = network.bsky.db
    did = 'did:example:alice'
  })

  afterAll(async () => {
    await network.close()
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
      await network.bsky.sub.indexingSvc.indexRecord(
        uri,
        cid,
        repost,
        WriteOpAction.Create,
        repost.createdAt,
      )
      uris.push(uri)
    }

    let count = await countRecords(db, 'repost')
    expect(count).toBe(1)

    await network.bsky.sub.indexingSvc.deleteRecord(uris[0], false)

    count = await countRecords(db, 'repost')
    expect(count).toBe(1)

    await network.bsky.sub.indexingSvc.deleteRecord(uris[1], true)

    count = await countRecords(db, 'repost')
    expect(count).toBe(0)
  })

  it('dedupes like', async () => {
    const subject = AtUri.make(did, lex.ids.AppBskyFeedPost, TID.nextStr())
    const subjectCid = await cidForCbor({ test: 'blah' })
    const coll = lex.ids.AppBskyFeedLike
    const uris: AtUri[] = []
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
      const cid = await cidForCbor(like)
      await network.bsky.sub.indexingSvc.indexRecord(
        uri,
        cid,
        like,
        WriteOpAction.Create,
        like.createdAt,
      )
      uris.push(uri)
    }

    let count = await countRecords(db, 'like')
    expect(count).toBe(1)

    await network.bsky.sub.indexingSvc.deleteRecord(uris[0], false)

    count = await countRecords(db, 'like')
    expect(count).toBe(1)
    const got = await db.db
      .selectFrom('like')
      .where('creator', '=', did)
      .selectAll()
      .executeTakeFirst()
    expect(got?.uri).toEqual(uris[1].toString())

    await network.bsky.sub.indexingSvc.deleteRecord(uris[1], true)

    count = await countRecords(db, 'like')
    expect(count).toBe(0)
  })

  it('dedupes follows', async () => {
    const coll = lex.ids.AppBskyGraphFollow
    const uris: AtUri[] = []
    for (let i = 0; i < 5; i++) {
      const follow = {
        $type: coll,
        subject: 'did:example:bob',
        createdAt: new Date().toISOString(),
      }
      const uri = AtUri.make(did, coll, TID.nextStr())
      const cid = await cidForCbor(follow)
      await network.bsky.sub.indexingSvc.indexRecord(
        uri,
        cid,
        follow,
        WriteOpAction.Create,
        follow.createdAt,
      )
      uris.push(uri)
    }

    let count = await countRecords(db, 'follow')
    expect(count).toBe(1)

    await network.bsky.sub.indexingSvc.deleteRecord(uris[0], false)

    count = await countRecords(db, 'follow')
    expect(count).toBe(1)

    await network.bsky.sub.indexingSvc.deleteRecord(uris[1], true)

    count = await countRecords(db, 'follow')
    expect(count).toBe(0)
  })
})
