import { AtUri } from '@atproto/uri'
import { Database } from '../../src'
import { cidForData, TID } from '@atproto/common'
import * as lex from '../../src/lexicon/lexicons'
import { APP_BSKY_GRAPH } from '../../src/lexicon'
import SqlMessageQueue from '../../src/event-stream/message-queue'
import { RecordService } from '../../src/services/record'
import { MessageQueue } from '../../src/event-stream/types'

describe('duplicate record', () => {
  let db: Database
  let messageQueue: MessageQueue

  beforeAll(async () => {
    if (process.env.DB_POSTGRES_URL) {
      db = Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'migration_duplicate_records',
      })
    } else {
      db = Database.memory()
    }
    messageQueue = new SqlMessageQueue('pds', db)
    await db.migrator.migrateTo('_20221021T162202001Z')
  })

  afterAll(async () => {
    await messageQueue.destroy()
    await db.close()
  })

  const did = 'did:example:alice'

  const indexRecord = async (record: any, times: number): Promise<void> => {
    const collection = record.$type
    const cid = await cidForData(record)
    await db.transaction(async (tx) => {
      const recordTx = new RecordService(tx, messageQueue)
      for (let i = 0; i < times; i++) {
        const uri = AtUri.make(did, collection, TID.nextStr())
        await recordTx.indexRecord(uri, cid, record)
      }
    })
  }

  it('has duplicate records', async () => {
    const subjectUri = AtUri.make(did, lex.ids.AppBskyFeedPost, TID.nextStr())
    const subjectCid = await cidForData({ test: 'blah' })
    const subjectDid = 'did:example:bob'
    const repost = {
      $type: lex.ids.AppBskyFeedRepost,
      subject: {
        uri: subjectUri.toString(),
        cid: subjectCid.toString(),
      },
      createdAt: new Date().toISOString(),
    }
    await indexRecord(repost, 5)
    const trend = {
      $type: lex.ids.AppBskyFeedTrend,
      subject: {
        uri: subjectUri.toString(),
        cid: subjectCid.toString(),
      },
      createdAt: new Date().toISOString(),
    }
    await indexRecord(trend, 5)
    const vote = {
      $type: lex.ids.AppBskyFeedVote,
      direction: 'up',
      subject: {
        uri: subjectUri.toString(),
        cid: subjectCid.toString(),
      },
      createdAt: new Date().toISOString(),
    }
    await indexRecord(vote, 5)
    const follow = {
      $type: lex.ids.AppBskyGraphFollow,
      subject: {
        did: subjectDid,
        declarationCid: subjectCid.toString(),
      },
      createdAt: new Date().toISOString(),
    }
    await indexRecord(follow, 5)
    const assertMember = {
      $type: lex.ids.AppBskyGraphAssertion,
      assertion: APP_BSKY_GRAPH.AssertMember,
      subject: {
        did: subjectDid,
        declarationCid: subjectCid.toString(),
      },
      createdAt: new Date().toISOString(),
    }
    await indexRecord(assertMember, 5)
    const assertCreator = {
      $type: lex.ids.AppBskyGraphAssertion,
      assertion: APP_BSKY_GRAPH.AssertCreator,
      subject: {
        did: subjectDid,
        declarationCid: subjectCid.toString(),
      },
      createdAt: new Date().toISOString(),
    }
    await indexRecord(assertCreator, 5)
  })

  it('migrates', async () => {
    await db.migrator.migrateTo('_20221116T234458063Z')
  })

  const countRecords = async (table: string) => {
    const got = await db.db
      .selectFrom(table as any)
      .selectAll()
      .where('creator', '=', did)
      .execute()
    return got.length
  }

  it('has deduped records', async () => {
    const repostCount = await countRecords('repost')
    expect(repostCount).toBe(1)
    const trendCount = await countRecords('trend')
    expect(trendCount).toBe(1)
    const voteCount = await countRecords('vote')
    expect(voteCount).toBe(1)
    const followCount = await countRecords('follow')
    expect(followCount).toBe(1)
    const assertionCount = await countRecords('assertion')
    expect(assertionCount).toBe(2)
  })
})
