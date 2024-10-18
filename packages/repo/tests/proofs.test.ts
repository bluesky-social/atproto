import { TID, cidForCbor, streamToBuffer } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { RecordCidClaim, RecordPath, Repo, RepoContents } from '../src'
import { MemoryBlockstore } from '../src/storage'
import * as sync from '../src/sync'

import * as util from './_util'

describe('Repo Proofs', () => {
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

  const getProofs = async (claims: RecordPath[]) => {
    return streamToBuffer(sync.getRecords(storage, repo.cid, claims))
  }

  const doVerify = (proofs: Uint8Array, claims: RecordCidClaim[]) => {
    return sync.verifyProofs(proofs, claims, repoDid, keypair.did())
  }

  const contentsToClaims = async (
    contents: RepoContents,
  ): Promise<RecordCidClaim[]> => {
    const claims: RecordCidClaim[] = []
    for (const coll of Object.keys(contents)) {
      for (const rkey of Object.keys(contents[coll])) {
        claims.push({
          collection: coll,
          rkey: rkey,
          cid: await cidForCbor(contents[coll][rkey]),
        })
      }
    }
    return claims
  }

  it('verifies valid records', async () => {
    const claims = await contentsToClaims(repoData)
    const proofs = await getProofs(claims)
    const results = await doVerify(proofs, claims)
    expect(results.verified.length).toBeGreaterThan(0)
    expect(results.verified).toEqual(claims)
    expect(results.unverified.length).toBe(0)
  })

  it('verifies record nonexistence', async () => {
    const claims: RecordCidClaim[] = [
      {
        collection: util.testCollections[0],
        rkey: TID.nextStr(), // does not exist
        cid: null,
      },
    ]
    const proofs = await getProofs(claims)
    const results = await doVerify(proofs, claims)
    expect(results.verified.length).toBeGreaterThan(0)
    expect(results.verified).toEqual(claims)
    expect(results.unverified.length).toBe(0)
  })

  it('does not verify a record that doesnt exist', async () => {
    const realClaims = await contentsToClaims(repoData)
    const claims: RecordCidClaim[] = [
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
    const realClaims = await contentsToClaims(repoData)
    const claims: RecordCidClaim[] = [
      {
        ...realClaims[0],
        cid: await util.randomCid(),
      },
    ]
    const proofs = await getProofs(claims)
    const results = await doVerify(proofs, claims)
    expect(results.verified.length).toBe(0)
    expect(results.unverified.length).toBeGreaterThan(0)
    expect(results.unverified).toEqual(claims)
  })

  it('does not verify a delete where the record does exist', async () => {
    const realClaims = await contentsToClaims(repoData)
    const claims: RecordCidClaim[] = [
      {
        collection: realClaims[0].collection,
        rkey: realClaims[0].rkey,
        cid: null,
      },
    ]
    const proofs = await getProofs(claims)
    const results = await doVerify(proofs, claims)
    expect(results.verified.length).toBe(0)
    expect(results.unverified.length).toBeGreaterThan(0)
    expect(results.unverified).toEqual(claims)
  })

  it('can determine record proofs from car file', async () => {
    const possible = await contentsToClaims(repoData)
    const claims = [
      //random sampling of records
      possible[0],
      possible[4],
      possible[5],
      possible[8],
    ]
    const proofs = await getProofs(claims)
    const records = await sync.verifyRecords(proofs, repoDid, keypair.did())
    for (const record of records) {
      const foundClaim = claims.find(
        (claim) =>
          claim.collection === record.collection && claim.rkey === record.rkey,
      )
      if (!foundClaim) {
        throw new Error('Could not find record for claim')
      }
      expect(foundClaim.cid).toEqual(
        await cidForCbor(repoData[record.collection][record.rkey]),
      )
    }
  })

  it('verifyProofs throws on a bad signature', async () => {
    const badRepo = await util.addBadCommit(repo, keypair)
    const claims = await contentsToClaims(repoData)
    const proofs = await streamToBuffer(
      sync.getRecords(storage, badRepo.cid, claims),
    )
    const fn = sync.verifyProofs(proofs, claims, repoDid, keypair.did())
    await expect(fn).rejects.toThrow(sync.RepoVerificationError)
  })
})
