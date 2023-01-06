import { TID } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { DidResolver } from '@atproto/did-resolver'
import { RecordWriteOp, Repo, RepoContents, WriteOpAction } from '../../src'
import { MemoryBlockstore } from '../../src/storage'
import * as verify from '../../src/verify'
import * as sync from '../../src/sync'

import * as util from '../_util'

describe('Narrow Sync', () => {
  let storage: MemoryBlockstore
  let repo: Repo
  let keypair: crypto.Keypair
  let repoData: RepoContents
  const didResolver = new DidResolver()

  beforeAll(async () => {
    storage = new MemoryBlockstore()
    keypair = await crypto.Secp256k1Keypair.create()
    repo = await Repo.create(storage, keypair.did(), keypair)
    const filled = await util.fillRepo(repo, keypair, 5)
    repo = filled.repo
    repoData = filled.data
  })

  const getProofs = async (ops: RecordWriteOp[]) => {
    const paths = util.pathsForOps(ops)
    return sync.getRecords(storage, repo.cid, paths)
  }

  const doVerify = (proofs: Uint8Array, ops: RecordWriteOp[]) => {
    return verify.verifyRecords(repo.did, proofs, ops, didResolver)
  }

  it('verifies valid records', async () => {
    const ops = util.contentsToCreateOps(repoData)
    const proofs = await getProofs(ops)
    const results = await doVerify(proofs, ops)
    expect(results.verified).toEqual(ops)
    expect(results.unverified.length).toBe(0)
  })

  it('verifies record nonexistence', async () => {
    const ops: RecordWriteOp[] = [
      {
        action: WriteOpAction.Delete,
        collection: util.testCollections[0],
        rkey: TID.nextStr(), // does not exist
      },
    ]
    const proofs = await getProofs(ops)
    const results = await doVerify(proofs, ops)
    expect(results.verified).toEqual(ops)
    expect(results.unverified.length).toBe(0)
  })

  it('does not verify a record that doesnt exist', async () => {
    const realOps = util.contentsToCreateOps(repoData)
    const ops: RecordWriteOp[] = [
      {
        ...realOps[0],
        rkey: TID.nextStr(),
      },
    ]
    const proofs = await getProofs(ops)
    const results = await doVerify(proofs, ops)
    expect(results.verified.length).toBe(0)
    expect(results.unverified).toEqual(ops)
  })

  it('does not verify an invalid record at a real path', async () => {
    const realOps = util.contentsToCreateOps(repoData)
    const ops: RecordWriteOp[] = [
      {
        ...realOps[0],
        record: util.generateObject(),
      },
    ]
    const proofs = await getProofs(ops)
    const results = await doVerify(proofs, ops)
    expect(results.verified.length).toBe(0)
    expect(results.unverified).toEqual(ops)
  })

  it('does not verify a delete where the record does exist', async () => {
    const realOps = util.contentsToCreateOps(repoData)
    const ops: RecordWriteOp[] = [
      {
        action: WriteOpAction.Delete,
        collection: realOps[0].collection,
        rkey: realOps[0].rkey,
      },
    ]
    const proofs = await getProofs(ops)
    const results = await doVerify(proofs, ops)
    expect(results.verified.length).toBe(0)
    expect(results.unverified).toEqual(ops)
  })

  it('throws on a bad signature', async () => {
    const badRepo = await util.addBadCommit(repo, keypair)
    const ops = util.contentsToCreateOps(repoData)
    const paths = util.pathsForOps(ops)
    const proofs = await sync.getRecords(storage, badRepo.cid, paths)
    const fn = verify.verifyRecords(repo.did, proofs, ops, didResolver)
    await expect(fn).rejects.toThrow(verify.RepoVerificationError)
  })
})
