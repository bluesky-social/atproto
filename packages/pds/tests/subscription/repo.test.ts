import { sql } from 'kysely'
import AtpAgent from '@atproto/api'
import { wait } from '@atproto/common'
import basicSeed from '../seeds/basic'
import { SeedClient } from '../seeds/client'
import { forSnapshot, runTestServer, TestServerInfo } from '../_util'
import { AppContext } from '../../src'
import { RepoSubscription } from '../../src/app-view/subscription/repo'

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
    await basicSeed(sc, ctx.messageQueue)
  })

  afterAll(async () => {
    await server.close()
  })

  it('rebuilds timeline indexes from repo state.', async () => {
    const { db } = ctx
    const { ref } = db.db.dynamic
    // Destroy indexes
    const originalTl = await agent.api.app.bsky.feed.getTimeline(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
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
      await entireSeqProcessed(ctx, sub)
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

  const indexedTables = [
    'duplicate_record',
    'user_notification',
    'assertion',
    'profile',
    'follow',
    'post',
    'post_hierarchy',
    'post_entity',
    'post_embed_image',
    'post_embed_external',
    'post_embed_record',
    'repost',
    'vote',
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

async function entireSeqProcessed(ctx: AppContext, sub: RepoSubscription) {
  const { db } = ctx.db
  const timeout = 5000
  const start = Date.now()
  while (Date.now() - start < timeout) {
    await wait(50)
    const subState = await sub.getState()
    const { lastSeq } = await db
      .selectFrom('repo_seq')
      .select(db.fn.max('repo_seq.seq').as('lastSeq'))
      .executeTakeFirstOrThrow()
    if (subState.cursor === lastSeq) return
  }
  throw new Error(`Sequence was not processed within ${timeout}ms`)
}
