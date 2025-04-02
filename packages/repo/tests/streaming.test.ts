import * as crypto from '@atproto/crypto'
import {
  MemoryBlockstore,
  RecordCidClaim,
  Repo,
  getFullRepo,
  verifyCarStreaming,
} from '../src'
import * as util from './_util'

describe('Streaming sync', () => {
  it('works', async () => {
    const storage = new MemoryBlockstore()
    const keypair = await crypto.Secp256k1Keypair.create()
    const created = await Repo.create(storage, 'did:example:test', keypair)
    const { repo } = await util.fillRepo(created, keypair, 20)
    const car = await getFullRepo(storage, repo.cid, { includeLeaves: false })

    const claims: RecordCidClaim[] = []
    for await (const claim of verifyCarStreaming(car)) {
      claims.push(claim)
    }
    expect(claims.length).toBe(40)
  })
})
