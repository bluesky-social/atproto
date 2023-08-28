import AtpAgent from '@atproto/api'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { randomBytes } from 'crypto'
import { TID, cidForCbor } from '@atproto/common'
import { IpldBlock } from '../../src/db/tables/ipld-block'
import { readCarWithRoot, verifyRepo } from '@atproto/repo'
import { Database } from '../../src'

describe('repo version upgrade', () => {
  let network: TestNetworkNoAppView
  let db: Database
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'repo_version_upgrade',
    })
    db = network.pds.ctx.db
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  const getNonAliceData = async () => {
    const ipldBlocksQb = db.db
      .selectFrom('ipld_block')
      .where('creator', '!=', alice)
      .selectAll()
      .orderBy('creator')
      .orderBy('cid')
    const recordsQb = db.db
      .selectFrom('record')
      .where('did', '!=', alice)
      .selectAll()
      .orderBy('did')
      .orderBy('uri')
    const repoBlobsQb = db.db
      .selectFrom('repo_blob')
      .where('did', '!=', alice)
      .selectAll()
      .orderBy('did')
      .orderBy('cid')
    const repoRootsQb = db.db
      .selectFrom('repo_root')
      .where('did', '!=', alice)
      .selectAll()
      .orderBy('did')
    const [ipldBlocks, records, repoBlobs, repoRoots] = await Promise.all([
      ipldBlocksQb.execute(),
      recordsQb.execute(),
      repoBlobsQb.execute(),
      repoRootsQb.execute(),
    ])
    return {
      ipldBlocks,
      records,
      repoBlobs,
      repoRoots,
    }
  }

  const addCruft = async (did: string) => {
    const cruft: IpldBlock[] = []
    for (let i = 0; i < 1000; i++) {
      const bytes = randomBytes(128)
      const cid = await cidForCbor(bytes)
      cruft.push({
        cid: cid.toString(),
        creator: did,
        repoRev: Math.random() > 0.5 ? TID.nextStr() : null,
        size: 128,
        content: bytes,
      })
    }
    await db.db.insertInto('ipld_block').values(cruft).execute()
    return cruft
  }

  const fetchAndVerifyRepo = async (did: string) => {
    const res = await agent.api.com.atproto.sync.getRepo({
      did,
    })
    const car = await readCarWithRoot(res.data)
    return verifyRepo(
      car.blocks,
      car.root,
      alice,
      network.pds.ctx.repoSigningKey.did(),
    )
  }

  it('upgrades a repo', async () => {
    const nonAliceDataBefore = await getNonAliceData()
    const aliceRepoBefore = await fetchAndVerifyRepo(alice)

    const cruft = await addCruft(alice)

    await agent.api.com.atproto.temp.upgradeRepoVersion(
      { did: alice },
      {
        headers: network.pds.adminAuthHeaders('admin'),
        encoding: 'application/json',
      },
    )

    const nonAliceDataAfter = await getNonAliceData()

    // does not affect other users
    expect(nonAliceDataAfter).toEqual(nonAliceDataBefore)

    // cleans up cruft
    const res = await db.db
      .selectFrom('ipld_block')
      .selectAll()
      .where('creator', '=', alice)
      .execute()
    const cidSet = new Set(res.map((row) => row.cid))
    for (const row of cruft) {
      expect(cidSet.has(row.cid)).toBe(false)
    }

    const aliceRepoAfter = await fetchAndVerifyRepo(alice)
    expect(aliceRepoAfter.creates).toEqual(aliceRepoBefore.creates)

    // it updated the repo rev on all blocks/records/blobs
    const root = await db.db
      .selectFrom('repo_root')
      .where('did', '=', alice)
      .selectAll()
      .executeTakeFirst()
    if (!root || !root.rev) {
      throw new Error('did not set rev')
    }
    expect(root.root).toEqual(aliceRepoAfter.commit.cid.toString())
    const nonUpgradedRecords = await db.db
      .selectFrom('record')
      .where('did', '=', alice)
      .where((qb) =>
        qb.where('repoRev', '!=', root.rev).orWhere('repoRev', 'is', null),
      )
      .selectAll()
      .execute()
    expect(nonUpgradedRecords.length).toBe(0)
    const nonUpgradedBlocks = await db.db
      .selectFrom('ipld_block')
      .where('creator', '=', alice)
      .where((qb) =>
        qb.where('repoRev', '!=', root.rev).orWhere('repoRev', 'is', null),
      )
      .selectAll()
      .execute()
    expect(nonUpgradedBlocks.length).toBe(0)
    const nonUpgradedBlobs = await db.db
      .selectFrom('repo_blob')
      .where('did', '=', alice)
      .where((qb) =>
        qb.where('repoRev', '!=', root.rev).orWhere('repoRev', 'is', null),
      )
      .selectAll()
      .execute()
    expect(nonUpgradedBlobs.length).toBe(0)
  })
})
