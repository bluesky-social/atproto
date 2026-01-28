import { TID } from '@atproto/common'
import { TestNetwork } from '@atproto/dev-env'
import { cidForLex } from '@atproto/lex-cbor'
import { WriteOpAction } from '@atproto/repo'
import { AtUri } from '@atproto/syntax'
import { app } from '../../src/lexicons/index.js'

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
    const subject = AtUri.make(did, app.bsky.feed.post.$nsid, TID.nextStr())
    const subjectCid = await cidForLex({ test: 'blah' })
    const uris: AtUri[] = []
    for (let i = 0; i < 5; i++) {
      const repost = app.bsky.feed.repost.$build({
        subject: {
          uri: subject.toString(),
          cid: subjectCid.toString(),
        },
        createdAt: new Date().toISOString(),
      })
      const uri = AtUri.make(did, repost.$type, TID.nextStr())
      const cid = await cidForLex(repost)
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
    const subject = AtUri.make(did, app.bsky.feed.post.$nsid, TID.nextStr())
    const subjectCid = await cidForLex({ test: 'blah' })
    const uris: AtUri[] = []
    for (let i = 0; i < 5; i++) {
      const like = app.bsky.feed.like.$build({
        subject: {
          uri: subject.toString(),
          cid: subjectCid.toString(),
        },
        createdAt: new Date().toISOString(),
      })
      const uri = AtUri.make(did, like.$type, TID.nextStr())
      const cid = await cidForLex(like)
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
    const uris: AtUri[] = []
    for (let i = 0; i < 5; i++) {
      const follow = app.bsky.graph.follow.$build({
        subject: 'did:example:bob',
        createdAt: new Date().toISOString(),
      })
      const uri = AtUri.make(did, follow.$type, TID.nextStr())
      const cid = await cidForLex(follow)
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
