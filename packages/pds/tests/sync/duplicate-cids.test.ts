import { CID } from 'multiformats/cid'
import { AtpAgent } from '@atproto/api'
import { Keypair, randomStr } from '@atproto/crypto'
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

  it('does not delete MST node blocks when deleting a record with a matching CID', async () => {
    // Create a record whose CID collides with an existing MST node, then
    // delete it and verify the MST node block is preserved.

    // Step 1: Create enough records to build a multi-node MST.
    for (let i = 0; i < 30; i++) {
      await sc.post(did, randomStr(32, 'base32'))
    }

    // Step 2: Load the current repo and its MST.
    const carRes = await agent.api.com.atproto.sync.getRepo({ did })
    const car = await repo.readCarWithRoot(carRes.data)
    const storage = new repo.MemoryBlockstore(car.blocks)
    const currentRepo = await repo.Repo.load(storage, car.root)

    // Step 3: Collect all non-root subtree nodes in the MST.
    const collectSubtrees = async (
      node: repo.MST,
      depth: number,
    ): Promise<repo.MST[]> => {
      const entries = await node.getEntries()
      const subtrees: repo.MST[] = []
      for (const entry of entries) {
        if (entry.isTree()) {
          // Only collect non-root nodes
          if (depth > 0) subtrees.push(entry)
          subtrees.push(...(await collectSubtrees(entry, depth + 1)))
        }
      }
      return subtrees
    }
    const subtreeNodes = await collectSubtrees(currentRepo.data, 0)
    expect(subtreeNodes.length).toBeGreaterThan(0)

    // Step 4: Find a subtree node that is NOT on the insertion path.
    // When we add a record whose value matches a node that is *not* on the
    // path being modified, the record CID will appear in newBlocks (via
    // newLeafCids). If the node IS on the path, treeDelete/leafAdd cancel
    // out and the CID won't appear in newBlocks - meaning the block already
    // exists and the import would work, but the deletion bug won't trigger
    // because the MST diff's treeAdd will cancel the leafDelete.
    const collection = 'zzz.test.dupe'
    const rkey = 'mst-duplicate'
    let targetCid: CID | undefined
    let commit: repo.CommitData | undefined

    for (const node of subtreeNodes) {
      const { cid, bytes } = await node.serialize()
      const candidateData = repo.cborToLexRecord(bytes)
      const writeOp: repo.RecordCreateOp = {
        action: repo.WriteOpAction.Create,
        collection,
        rkey,
        record: candidateData,
      }
      const candidateCommit = await currentRepo.formatCommit(
        writeOp,
        signingKey,
      )
      if (candidateCommit.newBlocks.has(cid)) {
        // This node is NOT on the insertion path - the bug will trigger
        targetCid = cid
        commit = candidateCommit
        break
      }
    }

    if (!targetCid || !commit) {
      throw new Error(
        'Could not find a subtree node that is off the insertion path',
      )
    }

    // Step 5: Package the commit as a CAR file and import it via the API.
    // importRepo bypasses record validation, allowing us to store a record
    // whose content is raw MST node data (no $type field).
    const importCar = await repo.blocksToCarFile(commit.cid, commit.newBlocks)
    await agent.api.com.atproto.repo.importRepo(importCar, {
      encoding: 'application/vnd.ipld.car',
      headers: sc.getHeaders(did),
    })

    // Step 6: Verify the import succeeded.
    const checkRecord = await agent.api.com.atproto.repo.getRecord({
      repo: did,
      collection,
      rkey,
    })
    expect(checkRecord).toBeDefined()

    // Step 7: Delete the record via the normal API.
    // The duplicate-CID logic *should* recognize that the block is still
    // referenced by an MST node and preserve it.
    await agent.api.com.atproto.repo.deleteRecord(
      { repo: did, collection, rkey },
      { headers: sc.getHeaders(did), encoding: 'application/json' },
    )

    // Step 8: Verify the repo is still valid. A missing MST node block here
    // would indicate that the shared block was incorrectly deleted.
    const afterCarRes = await agent.api.com.atproto.sync.getRepo({ did })
    const afterCar = await repo.readCarWithRoot(afterCarRes.data)
    await repo.verifyRepo(afterCar.blocks, afterCar.root, did, signingKey.did())
  })
})
