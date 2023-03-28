import AtpAgent from '@atproto/api'
import basicSeed from '../seeds/basic'
import { SeedClient } from '../seeds/client'
import {
  forSnapshot,
  processAll,
  runTestServer,
  TestServerInfo,
} from '../_util'
import { AppContext, Database } from '../../src'
import { DatabaseSchemaType } from '../../src/db/database-schema'

describe('sync', () => {
  let server: TestServerInfo
  let ctx: AppContext
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'subscription_repo',
    })
    ctx = server.ctx
    pdsAgent = new AtpAgent({ service: server.pdsUrl })
    sc = new SeedClient(pdsAgent)
    await basicSeed(sc)
  })

  afterAll(async () => {
    await server.close()
  })

  it('indexes permit history being replayed.', async () => {
    const { db } = ctx

    // Generate some modifications and dupes
    const { alice, bob, carol, dan } = sc.dids
    await sc.follow(alice, sc.actorRef(bob))
    await sc.follow(carol, sc.actorRef(alice))
    await sc.follow(bob, sc.actorRef(alice))
    await sc.follow(dan, sc.actorRef(bob))
    await sc.vote('down', bob, sc.posts[alice][1].ref) // Reversed
    await sc.vote('up', bob, sc.posts[alice][2].ref) // Reversed
    await sc.vote('up', carol, sc.posts[alice][1].ref) // Reversed
    await sc.vote('down', carol, sc.posts[alice][2].ref) // Reversed
    await sc.vote('up', dan, sc.posts[alice][1].ref) // Identical
    await sc.vote('up', alice, sc.posts[carol][0].ref) // Identical
    await pdsAgent.api.app.bsky.actor.updateProfile(
      { displayName: 'ali!' },
      { headers: sc.getHeaders(alice), encoding: 'application/json' },
    )
    await pdsAgent.api.app.bsky.actor.updateProfile(
      { displayName: 'robert!' },
      { headers: sc.getHeaders(bob), encoding: 'application/json' },
    )

    await processAll(server)

    // Table comparator
    const getTableDump = async () => {
      const [actor, post, profile, vote, follow, dupes] = await Promise.all([
        dumpTable(db, 'actor', ['did']),
        dumpTable(db, 'post', ['uri']),
        dumpTable(db, 'profile', ['uri']),
        dumpTable(db, 'vote', ['creator', 'subject']),
        dumpTable(db, 'follow', ['creator', 'subjectDid']),
        dumpTable(db, 'duplicate_record', ['uri']),
      ])
      return { actor, post, profile, vote, follow, dupes }
    }

    // Mark originals
    const originalTableDump = await getTableDump()

    // Reprocess repos via sync subscription, on top of existing indices
    await server.bsky.sub.destroy()
    await server.bsky.sub.resetState()
    server.bsky.sub.resume()
    await processAll(server)

    // Permissive of indexedAt times changing
    expect(forSnapshot(await getTableDump())).toEqual(
      forSnapshot(originalTableDump),
    )
  })
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
