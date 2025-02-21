import { AtpAgent } from '@atproto/api'
import { cborDecode, cborEncode } from '@atproto/common'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { CommitDataWithOps, sequencer } from '@atproto/pds'
import { DatabaseSchemaType } from '../../src/data-plane/server/db/database-schema'
import { ids } from '../../src/lexicon/lexicons'
import { forSnapshot } from '../_util'

type Database = TestNetwork['bsky']['db']

describe('sync', () => {
  let network: TestNetwork
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_subscription_repo',
    })
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
  })

  afterAll(async () => {
    await network.close()
  })

  it('indexes permit history being replayed.', async () => {
    const { db } = network.bsky

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
    await network.bsky.sub.restart()
    await network.processAll()

    // Permissive of indexedAt times changing
    expect(forSnapshot(await getTableDump())).toEqual(
      forSnapshot(originalTableDump),
    )
  })

  it('indexes actor when commit is unprocessable.', async () => {
    // mock sequencing to create an unprocessable commit event
    const sequenceCommitOrig = network.pds.ctx.sequencer.sequenceCommit
    network.pds.ctx.sequencer.sequenceCommit = async function (
      did: string,
      commitData: CommitDataWithOps,
    ) {
      const seqEvt = await sequencer.formatSeqCommit(did, commitData)
      const evt = cborDecode(seqEvt.event) as sequencer.CommitEvt
      evt.blocks = new Uint8Array() // bad blocks
      seqEvt.event = cborEncode(evt)
      return await network.pds.ctx.sequencer.sequenceEvt(seqEvt)
    }
    // create account and index the initial commit event
    await sc.createAccount('jack', {
      handle: 'jack.test',
      email: 'jack@test.com',
      password: 'password',
    })
    await network.processAll()
    // confirm jack was indexed as an actor despite the bad event
    const actors = await dumpTable(network.bsky.db, 'actor', ['did'])
    expect(actors.map((a) => a.handle)).toContain('jack.test')
    network.pds.ctx.sequencer.sequenceCommit = sequenceCommitOrig
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
