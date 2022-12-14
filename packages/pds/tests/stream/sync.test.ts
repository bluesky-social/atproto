import { sql } from 'kysely'
import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { getWriteOpLog } from '@atproto/repo'
import { Database } from '../../src'
import SqlBlockstore from '../../src/sql-blockstore'
import { indexWrites, prepareWrites } from '../../src/repo'
import { Locals, get as getLocals } from '../../src/locals'
import basicSeed from '../seeds/basic'
import { SeedClient } from '../seeds/client'
import { forSnapshot, runTestServer, TestServerInfo } from '../_util'

describe('sync', () => {
  let server: TestServerInfo
  let locals: Locals
  let client: AtpServiceClient
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'stream_sync',
    })
    locals = getLocals(server.app)
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await basicSeed(sc, locals.db.messageQueue)
  })

  afterAll(async () => {
    await server.close()
  })

  it('rebuilds timeline indexes from repo state.', async () => {
    const { db } = locals
    const { ref } = db.db.dynamic
    // Destroy indexes
    await Promise.all(
      indexedTables.map((t) => sql`delete from ${ref(t)}`.execute(db.db)),
    )
    // Confirm timeline empty
    const emptiedTL = await client.app.bsky.feed.getTimeline(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(emptiedTL.data.feed).toEqual([])
    // Compute oplog from state of all repos
    const repoOpLogs = await Promise.all(
      Object.entries(sc.dids)
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB)) // Order for test determinism
        .map(([, did]) => did)
        .map(async (did) => ({
          did,
          opLog: await getOpLog(db, did),
        })),
    )
    const indexOps = repoOpLogs.flatMap(({ did, opLog }) =>
      opLog.map((ops) => ({ did, ops })),
    )
    // Run oplog through indexers
    let ts = Date.now() // Increment for test determinism
    for (const op of indexOps) {
      const now = new Date(ts++).toISOString()
      const writes = await prepareWrites(op.did, op.ops)
      await db.transaction((dbTxn) => indexWrites(dbTxn, writes, now))
    }
    await db.messageQueue?.processAll()
    // Check indexed timeline
    const aliceTL = await client.app.bsky.feed.getTimeline(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(forSnapshot(aliceTL.data.feed)).toMatchSnapshot()
  })

  async function getOpLog(db: Database, did: string) {
    const repoRoot = await db.getRepoRoot(did)
    if (!repoRoot) throw new Error('Missing repo root')
    const blockstore = new SqlBlockstore(db, did)
    return await getWriteOpLog(blockstore, null, repoRoot)
  }

  const indexedTables = [
    'record',
    'duplicate_record',
    'user_notification',
    'assertion',
    'profile',
    'follow',
    'post',
    'post_entity',
    'repost',
    'vote',
    'scene',
    'trend',
    'scene_member_count',
    'scene_votes_on_post',
    /* Not these:
     * 'ipld_block',
     * 'ipld_block_creator',
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
