import AtpAgent from '@atproto/api'
import basicSeed from '../seeds/basic'
import { SeedClient } from '../seeds/client'
import { runTestEnv, TestEnvInfo } from '@atproto/dev-env'
import { forSnapshot, processAll } from '../_util'
import { AppContext, Database } from '../../src'
import { DatabaseSchemaType } from '../../src/db/database-schema'
import { ids } from '../../src/lexicon/lexicons'

describe('sync', () => {
  let testEnv: TestEnvInfo
  let ctx: AppContext
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'subscription_repo',
    })
    ctx = testEnv.bsky.ctx
    pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await testEnv.close()
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
    await updateProfile(pdsAgent, alice, { displayName: 'ali!' })
    await updateProfile(pdsAgent, bob, { displayName: 'robert!' })

    await processAll(testEnv)

    // Table comparator
    const getTableDump = async () => {
      const [actor, post, profile, like, follow, dupes] = await Promise.all([
        dumpTable(db, 'actor', ['did']),
        dumpTable(db, 'post', ['uri']),
        dumpTable(db, 'profile', ['uri']),
        dumpTable(db, 'like', ['creator', 'subject']),
        dumpTable(db, 'follow', ['creator', 'subjectDid']),
        dumpTable(db, 'duplicate_record', ['uri']),
      ])
      return { actor, post, profile, like, follow, dupes }
    }

    // Mark originals
    const originalTableDump = await getTableDump()

    // Reprocess repos via sync subscription, on top of existing indices
    await testEnv.bsky.sub?.destroy()
    await testEnv.bsky.sub?.resetState()
    testEnv.bsky.sub?.resume()
    await processAll(testEnv)

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
})

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
