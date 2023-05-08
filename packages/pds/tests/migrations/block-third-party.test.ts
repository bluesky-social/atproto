import AtpAgent, { AtUri } from '@atproto/api'
import { Database } from '../../src'
import { CloseFn, runTestServer } from '../_util'
import { RecordRef, SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

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

    // setup, dan blocks carol
    const danBlocksCarol = await agent.api.app.bsky.graph.block.create(
      { repo: dan },
      { createdAt: new Date().toISOString(), subject: carol },
      sc.getHeaders(dan),
    )
    await expect(getBlocked()).resolves.toEqual(blockFixture)

    // migrate down then back up, should land in same state
    await db.migrateToOrThrow('_20230428T195614638Z')
    await db.migrateToLatestOrThrow()
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

    // migrate down then back up, should land in same state
    await db.migrateToOrThrow('_20230428T195614638Z')
    await db.migrateToLatestOrThrow()
    await expect(getBlocked()).resolves.toEqual(blockFixture)
  })
})
