import { sql } from 'kysely'
import AtpAgent from '@atproto/api'
import { wait } from '@atproto/common'
import basicSeed from '../seeds/basic'
import { SeedClient } from '../seeds/client'
import { forSnapshot, runTestServer, TestServerInfo } from '../_util'
import { AppContext, Database } from '../../src'
import { RepoSubscription } from '../../src/app-view/subscription/repo'
import { DatabaseSchemaType } from '../../src/app-view/db'
import { ids } from '../../src/lexicon/lexicons'

describe('sync', () => {
  let server: TestServerInfo
  let ctx: AppContext
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'subscription_repo',
    })
    ctx = server.ctx
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await server.close()
  })

  it('rebuilds timeline indexes from repo state.', async () => {
    const { db } = ctx
    const { ref } = db.db.dynamic
    const originalTl = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    // Destroy indexes
    await Promise.all(
      indexedTables.map((t) => sql`delete from ${ref(t)}`.execute(db.db)),
    )
    // Confirm timeline empty
    const emptiedTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(emptiedTL.data.feed).toEqual([])

    // Process repos via sync subscription
    const sub = new RepoSubscription(
      ctx,
      server.url.replace('http://', 'ws://'),
    )

    try {
      sub.run()
      await processFullSequence(ctx, sub)
    } finally {
      sub.destroy()
    }

    // Check indexed timeline
    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )

    expect(forSnapshot(aliceTL.data.feed)).toEqual(
      forSnapshot(originalTl.data.feed),
    )
  })

  it('indexes permit history being replayed.', async () => {
    const { db } = ctx

    // Generate some modifications and dupes
    const { alice, bob, carol, dan } = sc.dids
    await sc.follow(alice, bob)
    await sc.follow(carol, alice)
    await sc.follow(bob, alice)
    await sc.follow(dan, bob)
    await sc.like(dan, sc.posts[alice][1].ref) // Identical
    await sc.like(alice, sc.posts[carol][0].ref) // Identical
    await updateProfile(agent, alice, { displayName: 'ali!' })
    await updateProfile(agent, bob, { displayName: 'robert!' })

    // Table comparator
    const getTableDump = async () => {
      const [post, profile, like, follow, dupes] = await Promise.all([
        dumpTable(db, 'post', ['uri']),
        dumpTable(db, 'profile', ['uri']),
        dumpTable(db, 'like', ['creator', 'subject']),
        dumpTable(db, 'follow', ['creator', 'subjectDid']),
        dumpTable(db, 'duplicate_record', ['uri']),
      ])
      return { post, profile, like, follow, dupes }
    }

    // Mark originals
    const originalTableDump = await getTableDump()
    const originalTl = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )

    // Destroy subscription state
    const { numDeletedRows } = await db.db
      .deleteFrom('subscription')
      .where('method', '=', 'com.atproto.sync.subscribeRepos')
      .executeTakeFirst()
    expect(Number(numDeletedRows)).toEqual(1)

    // Reprocess repos via sync subscription, on top of existing indices
    const sub = new RepoSubscription(
      ctx,
      server.url.replace('http://', 'ws://'),
    )

    try {
      sub.run()
      await processFullSequence(ctx, sub)
    } finally {
      sub.destroy()
    }

    // Check indexed timeline
    const aliceTL = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )

    expect(forSnapshot(aliceTL.data.feed)).toEqual(
      forSnapshot(originalTl.data.feed),
    )

    // Permissive of indexedAt times changing
    expect(forSnapshot(await getTableDump())).toEqual(
      forSnapshot(originalTableDump),
    )
  })

  async function updateProfile(
    agent: AtpAgent,
    did: string,
    record: Record<string, unknown>,
  ) {
    return await agent.api.com.atproto.repo.putRecord(
      {
        repo: did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record,
      },
      { headers: sc.getHeaders(did), encoding: 'application/json' },
    )
  }

  const indexedTables = [
    'duplicate_record',
    'user_notification',
    'profile',
    'follow',
    'post',
    'post_hierarchy',
    'post_embed_image',
    'post_embed_external',
    'post_embed_record',
    'repost',
    'feed_item',
    'like',
    /* Not these:
     * 'record', // Shared, but governed by pds
     * 'ipld_block',
     * 'blob',
     * 'repo_blob',
     * 'user',
     * 'did_handle',
     * 'refresh_token',
     * 'repo_root',
     * 'invite_code',
     * 'invite_code_use',
     * 'message_queue',
     * 'message_queue_cursor',
     */
  ]
})

async function processFullSequence(ctx: AppContext, sub: RepoSubscription) {
  const { db } = ctx.db
  const timeout = 5000
  const start = Date.now()
  while (Date.now() - start < timeout) {
    await wait(50)
    const state = await sub.getState()
    const { lastSeq } = await db
      .selectFrom('repo_seq')
      .select(db.fn.max('repo_seq.seq').as('lastSeq'))
      .executeTakeFirstOrThrow()
    if (state.cursor === lastSeq) return
  }
  throw new Error(`Sequence was not processed within ${timeout}ms`)
}

async function dumpTable<T extends keyof DatabaseSchemaType>(
  db: Database,
  tableName: T,
  pkeys: (keyof DatabaseSchemaType[T] & string)[],
) {
  const { ref } = db.db.dynamic
  let builder = db.db.selectFrom(tableName).selectAll()
  pkeys.forEach((key) => {
    builder = builder.orderBy(ref(key))
  })
  return await builder.execute()
}
