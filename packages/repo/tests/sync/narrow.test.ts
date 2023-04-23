import { TID, streamToBuffer } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { RecordClaim, Repo, RepoContents } from '../../src'
import { MemoryBlockstore } from '../../src/storage'
import * as verify from '../../src/verify'
import * as sync from '../../src/sync'

import * as util from '../_util'

describe('Narrow Sync', () => {
  let storage: MemoryBlockstore
  let repo: Repo
  let keypair: crypto.Keypair
  let repoData: RepoContents

  const repoDid = 'did:example:test'

  beforeAll(async () => {
    storage = new MemoryBlockstore()
    keypair = await crypto.Secp256k1Keypair.create()
    repo = await Repo.create(storage, repoDid, keypair)
    const filled = await util.fillRepo(repo, keypair, 5)
    repo = filled.repo
    repoData = filled.data
  })

  const getProofs = async (claims: RecordClaim[]) => {
    return streamToBuffer(sync.getRecords(storage, repo.cid, claims))
  }

  const doVerify = (proofs: Uint8Array, claims: RecordClaim[]) => {
    return verify.verifyProofs(proofs, claims, repoDid, keypair.did())
  }

  it('verifies valid records', async () => {
    const claims = util.contentsToClaims(repoData)
    const proofs = await getProofs(claims)
    const results = await doVerify(proofs, claims)
    expect(results.verified.length).toBeGreaterThan(0)
    expect(results.verified).toEqual(claims)
    expect(results.unverified.length).toBe(0)
  })

  it('verifies record nonexistence', async () => {
    const claims: RecordClaim[] = [
      {
        collection: util.testCollections[0],
        rkey: TID.nextStr(), // does not exist
        record: null,
      },
    ]
    const proofs = await getProofs(claims)
    const results = await doVerify(proofs, claims)
    expect(results.verified.length).toBeGreaterThan(0)
    expect(results.verified).toEqual(claims)
    expect(results.unverified.length).toBe(0)
  })

  it('does not verify a record that doesnt exist', async () => {
    const realClaims = util.contentsToClaims(repoData)
    const claims: RecordClaim[] = [
      {
        ...realClaims[0],
        rkey: TID.nextStr(),
      },
    ]
    const proofs = await getProofs(claims)
    const results = await doVerify(proofs, claims)
    expect(results.verified.length).toBe(0)
    expect(results.unverified.length).toBeGreaterThan(0)
    expect(results.unverified).toEqual(claims)
  })

  it('does not verify an invalid record at a real path', async () => {
    const realClaims = util.contentsToClaims(repoData)
    const claims: RecordClaim[] = [
      {
        ...realClaims[0],
        record: util.generateObject(),
      },
    ]
    const proofs = await getProofs(claims)
    const results = await doVerify(proofs, claims)
    expect(results.verified.length).toBe(0)
    expect(results.unverified.length).toBeGreaterThan(0)
    expect(results.unverified).toEqual(claims)
  })

  it('does not verify a delete where the record does exist', async () => {
    const realClaims = util.contentsToClaims(repoData)
    const claims: RecordClaim[] = [
      {
        collection: realClaims[0].collection,
        rkey: realClaims[0].rkey,
        record: null,
      },
    ]
    const proofs = await getProofs(claims)
    const results = await doVerify(proofs, claims)
    expect(results.verified.length).toBe(0)
    expect(results.unverified.length).toBeGreaterThan(0)
    expect(results.unverified).toEqual(claims)
  })

  it('can determine record proofs from car file', async () => {
    const possible = util.contentsToClaims(repoData)
    const claims = [
      //random sampling of records
      possible[0],
      possible[4],
      possible[5],
      possible[8],
    ]
    const proofs = await getProofs(claims)
    const records = await verify.verifyRecords(proofs, repoDid, keypair.did())
    for (const record of records) {
      const foundClaim = claims.find(
        (claim) =>
          claim.collection === record.collection && claim.rkey === record.rkey,
      )
      if (!foundClaim) {
        throw new Error('Could not find record for claim')
      }
      expect(foundClaim.record).toEqual(
        repoData[record.collection][record.rkey],
      )
    }
  })

  it('verifyRecords throws on a bad signature', async () => {
    const badRepo = await util.addBadCommit(repo, keypair)
    const claims = util.contentsToClaims(repoData)
    const proofs = await streamToBuffer(
      sync.getRecords(storage, badRepo.cid, claims),
    )
    const fn = verify.verifyRecords(proofs, repoDid, keypair.did())
    await expect(fn).rejects.toThrow(verify.RepoVerificationError)
  })

  it('verifyProofs throws on a bad signature', async () => {
    const badRepo = await util.addBadCommit(repo, keypair)
    const claims = util.contentsToClaims(repoData)
    const proofs = await streamToBuffer(
      sync.getRecords(storage, badRepo.cid, claims),
    )
    const fn = verify.verifyProofs(proofs, claims, repoDid, keypair.did())
    await expect(fn).rejects.toThrow(verify.RepoVerificationError)
  })
})
