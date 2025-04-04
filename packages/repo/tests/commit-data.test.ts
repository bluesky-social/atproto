import { Secp256k1Keypair } from '@atproto/crypto'
import { Repo, WriteOpAction, blocksToCarFile, verifyProofs } from '../src'
import { MemoryBlockstore } from '../src/storage'

describe('Commit data', () => {
  // @NOTE this test uses a fully deterministic tree structure
  it('includes all relevant blocks for proof in commit data', async () => {
    const did = 'did:example:alice'
    const collection = 'com.atproto.test'
    const record = {
      test: 123,
    }

    const blockstore = new MemoryBlockstore()
    const keypair = await Secp256k1Keypair.create()
    let repo = await Repo.create(blockstore, did, keypair)

    const keys: string[] = []
    for (let i = 0; i < 50; i++) {
      const rkey = `key-${i}`
      keys.push(rkey)
      repo = await repo.applyWrites(
        [
          {
            action: WriteOpAction.Create,
            collection,
            rkey,
            record,
          },
        ],
        keypair,
      )
    }

    // this test demonstrates the test case:
    // specifically in the case of deleting the first key, there is a "rearranged block" that is necessary
    // in the proof path but _is not_ in newBlocks (as it already existed in the repository)
    {
      const commit = await repo.formatCommit(
        {
          action: WriteOpAction.Delete,
          collection,
          rkey: keys[0],
        },
        keypair,
      )
      const car = await blocksToCarFile(commit.cid, commit.newBlocks)
      const proofAttempt = verifyProofs(
        car,
        [
          {
            collection,
            rkey: keys[0],
            cid: null,
          },
        ],
        did,
        keypair.did(),
      )
      await expect(proofAttempt).rejects.toThrow(/block not found/)
    }

    for (const rkey of keys) {
      const commit = await repo.formatCommit(
        {
          action: WriteOpAction.Delete,
          collection,
          rkey,
        },
        keypair,
      )
      const car = await blocksToCarFile(commit.cid, commit.relevantBlocks)
      const proofRes = await verifyProofs(
        car,
        [
          {
            collection,
            rkey: rkey,
            cid: null,
          },
        ],
        did,
        keypair.did(),
      )
      expect(proofRes.unverified.length).toBe(0)
      repo = await repo.applyCommit(commit)
    }
  })
})
