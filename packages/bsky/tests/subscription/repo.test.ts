import AtpAgent from '@atproto/api'
import { TestNetwork, SeedClient } from '@atproto/dev-env'
import { CommitData } from '@atproto/repo'
import { RepoService } from '@atproto/pds/src/services/repo'
import { PreparedWrite } from '@atproto/pds/src/repo'
import * as sequencer from '@atproto/pds/src/sequencer'
import { cborDecode, cborEncode } from '@atproto/common'
import { DatabaseSchemaType } from '../../src/db/database-schema'
import { ids } from '../../src/lexicon/lexicons'
import { forSnapshot } from '../_util'
import { AppContext, Database } from '../../src'
import basicSeed from '../seeds/basic'

describe('sync', () => {
  let network: TestNetwork
  let ctx: AppContext
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_subscription_repo',
    })
    ctx = network.bsky.ctx
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  it('indexes permit history being replayed.', async () => {
    const db = ctx.db.getPrimary()

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

    await network.processAll()

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
    await network.bsky.ingester.sub.destroy()
    await network.bsky.indexer.sub.destroy()
    // Hard reset of state in redis
    await network.bsky.ingester.sub.resetCursor()
    const indexerSub = network.bsky.indexer.sub
    const partition = indexerSub.partitions.get(0)
    await network.bsky.indexer.ctx.redis.del(partition.key)
    // Boot streams back up
    network.bsky.indexer.sub.resume()
    network.bsky.ingester.sub.resume()
    await network.processAll()

    // Permissive of indexedAt times changing
    expect(forSnapshot(await getTableDump())).toEqual(
      forSnapshot(originalTableDump),
    )
  })

  it('indexes actor when commit is unprocessable.', async () => {
    // mock sequencing to create an unprocessable commit event
    const afterWriteProcessingOriginal =
      RepoService.prototype.afterWriteProcessing
    RepoService.prototype.afterWriteProcessing = async function (
      did: string,
      commitData: CommitData,
      writes: PreparedWrite[],
    ) {
      const seqEvt = await sequencer.formatSeqCommit(did, commitData, writes)
      const evt = cborDecode(seqEvt.event) as sequencer.CommitEvt
      evt.blocks = new Uint8Array() // bad blocks
      seqEvt.event = cborEncode(evt)
      await sequencer.sequenceEvt(this.db, seqEvt)
    }
    // create account and index the initial commit event
    await sc.createAccount('jack', {
      handle: 'jack.test',
      email: 'jack@test.com',
      password: 'password',
    })
    await network.pds.ctx.sequencerLeader?.isCaughtUp()
    await network.processAll()
    // confirm jack was indexed as an actor despite the bad event
    const actors = await dumpTable(ctx.db.getPrimary(), 'actor', ['did'])
    expect(actors.map((a) => a.handle)).toContain('jack.test')
    RepoService.prototype.afterWriteProcessing = afterWriteProcessingOriginal
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
