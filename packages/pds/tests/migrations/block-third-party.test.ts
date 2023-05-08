import AtpAgent, { AtUri } from '@atproto/api'
import { Database } from '../../src'
import { CloseFn, runTestServer } from '../_util'
import { RecordRef, SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { dataMigrationQbs } from '../../src/db/migrations/20230504T210229992Z-block-third-party'

describe('block third-party data migration', () => {
  let db: Database
  let close: CloseFn
  let agent: AtpAgent
  let sc: SeedClient
  let carolReplyToDan: { ref: RecordRef }

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'migration_block_third_party',
    })
    db = server.ctx.db
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    const { carol, dan } = sc.dids
    carolReplyToDan = await sc.reply(
      carol,
      sc.posts[dan][0].ref,
      sc.posts[dan][0].ref,
      'carol replies to dan',
    )
  })

  afterAll(async () => {
    await close()
  })

  const getBlocked = async () => {
    const [replies, embeds] = await Promise.all([
      db.db
        .selectFrom('post')
        .where('replyBlocked', '=', 1)
        .selectAll()
        .execute(),
      db.db
        .selectFrom('post_embed_record')
        .where('embedBlocked', '=', 1)
        .selectAll()
        .execute(),
    ])
    return {
      replies: replies.reduce((acc, reply) => {
        return Object.assign(acc, { [reply.uri]: true })
      }, {} as Record<string, boolean>),
      embeds: embeds.reduce((acc, embed) => {
        return Object.assign(acc, { [embed.postUri]: embed.embedUri })
      }, {} as Record<string, string>),
    }
  }

  it('sets-up initial block state on replies and embeds', async () => {
    const { carol, dan } = sc.dids
    const blockFixture = {
      replies: {
        [carolReplyToDan.ref.uriStr]: true,
      },
      embeds: {
        [sc.posts[dan][1].ref.uriStr]: sc.posts[carol][0].ref.uriStr,
      },
    }
    const reset = async () => {
      await db.db.updateTable('post').set({ replyBlocked: 0 }).execute()
      await db.db
        .updateTable('post_embed_record')
        .set({ embedBlocked: 0 })
        .execute()
    }
    const migrate = async () => {
      for (const qb of migrationQbs) {
        await qb.execute()
      }
    }

    const migrationQbs = dataMigrationQbs(db.db)
    // setup, dan blocks carol
    const danBlocksCarol = await agent.api.app.bsky.graph.block.create(
      { repo: dan },
      { createdAt: new Date().toISOString(), subject: carol },
      sc.getHeaders(dan),
    )
    await expect(getBlocked()).resolves.toEqual(blockFixture)

    // reset then migrate, should land in same state
    await reset()
    await migrate()
    await expect(getBlocked()).resolves.toEqual(blockFixture)

    // setup, carol blocks dan (testing symmetry of blocks)
    await agent.api.app.bsky.graph.block.delete(
      { repo: dan, rkey: new AtUri(danBlocksCarol.uri).rkey },
      sc.getHeaders(dan),
    )
    await agent.api.app.bsky.graph.block.create(
      { repo: carol },
      { createdAt: new Date().toISOString(), subject: dan },
      sc.getHeaders(carol),
    )
    await expect(getBlocked()).resolves.toEqual(blockFixture)

    // reset then migrate, should land in same state
    await reset()
    await migrate()
    await expect(getBlocked()).resolves.toEqual(blockFixture)
  })
})
