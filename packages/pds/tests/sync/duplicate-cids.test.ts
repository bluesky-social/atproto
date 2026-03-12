import { AtpAgent } from '@atproto/api'
import { Keypair } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import * as repo from '@atproto/repo'
import { AtUri } from '@atproto/syntax'

describe('duplicate record/mst-node CIDs', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let did: string
  let signingKey: Keypair

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'duplicate_cids',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    did = sc.dids.alice
    signingKey = await network.pds.ctx.actorStore.keypair(did)
  })

  afterAll(async () => {
    await network.close()
  })

  it('does not delete record blocks when another record shares the same CID', async () => {
    // Create two records with identical content in the same collection,
    // producing the same CID. Deleting one should not remove the shared block.
    const collection = 'com.example.record'
    const record = { $type: collection, value: 'duplicate-content' }
    const res1 = await agent.api.com.atproto.repo.createRecord(
      { repo: did, collection, record },
      { headers: sc.getHeaders(did), encoding: 'application/json' },
    )
    const res2 = await agent.api.com.atproto.repo.createRecord(
      { repo: did, collection, record },
      { headers: sc.getHeaders(did), encoding: 'application/json' },
    )
    expect(res1.data.cid).toEqual(res2.data.cid)

    // Delete the first record.
    const uri1 = new AtUri(res1.data.uri)
    await agent.api.com.atproto.repo.deleteRecord(
      { repo: did, collection: uri1.collection, rkey: uri1.rkey },
      { headers: sc.getHeaders(did), encoding: 'application/json' },
    )

    // The second record should still be readable.
    const uri2 = new AtUri(res2.data.uri)
    const remaining = await agent.api.com.atproto.repo.getRecord({
      repo: did,
      collection: uri2.collection,
      rkey: uri2.rkey,
    })
    expect(remaining.data.cid).toEqual(res2.data.cid)

    // The repo should still be valid.
    const carRes = await agent.api.com.atproto.sync.getRepo({ did })
    const car = await repo.readCarWithRoot(carRes.data)
    await repo.verifyRepo(car.blocks, car.root, did, signingKey.did())
  })

  it('rejects importing a record without a $type field', async () => {
    const carRes = await agent.api.com.atproto.sync.getRepo({ did })
    const car = await repo.readCarWithRoot(carRes.data)
    const storage = new repo.MemoryBlockstore(car.blocks)
    const currentRepo = await repo.Repo.load(storage, car.root)

    const writeOp: repo.RecordCreateOp = {
      action: repo.WriteOpAction.Create,
      collection: 'zzz.test.dupe',
      rkey: 'no-type',
      record: { value: 'no-type' },
    }
    const commit = await currentRepo.formatCommit(writeOp, signingKey)

    const importCar = await repo.blocksToCarFile(commit.cid, commit.newBlocks)
    await expect(
      agent.api.com.atproto.repo.importRepo(importCar, {
        encoding: 'application/vnd.ipld.car',
        headers: sc.getHeaders(did),
      }),
    ).rejects.toThrow(/missing a \$type field/)
  })
})
