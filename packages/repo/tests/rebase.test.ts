import * as crypto from '@atproto/crypto'
import { Repo } from '../src/repo'
import { MemoryBlockstore } from '../src/storage'
import * as util from './_util'
import { Secp256k1Keypair } from '@atproto/crypto'

describe('Rebases', () => {
  let storage: MemoryBlockstore
  let keypair: crypto.Keypair
  let repo: Repo

  it('fills a repo with data', async () => {
    storage = new MemoryBlockstore()
    keypair = await Secp256k1Keypair.create()
    repo = await Repo.create(storage, keypair.did(), keypair)
    const filled = await util.fillRepo(repo, keypair, 100)
    repo = filled.repo
  })

  it('rebases the repo & preserves contents', async () => {
    const dataCidBefore = await repo.data.getPointer()
    const contents = await repo.getContents()
    repo = await repo.rebase(keypair)
    const rebasedContents = await repo.getContents()
    expect(rebasedContents).toEqual(contents)
    const dataCidAfter = await repo.data.getPointer()
    expect(dataCidAfter.equals(dataCidBefore)).toBeTruthy()
  })

  it('only keeps around relevant cids', async () => {
    const allCids = await repo.data.allCids()
    allCids.add(repo.cid)
    for (const cid of storage.blocks.cids()) {
      expect(allCids.has(cid)).toBeTruthy()
    }
  })
})
