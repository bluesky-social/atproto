import * as crypto from '@atproto/crypto'
import { CidSet, Repo, RepoContents, RepoVerificationError } from '../../src'
import { MemoryBlockstore } from '../../src/storage'
import * as sync from '../../src/sync'

import * as util from '../_util'
import { streamToBuffer } from '@atproto/common'
import { CarReader } from '@ipld/car/reader'

describe('Checkout Sync', () => {
  let storage: MemoryBlockstore
  let syncStorage: MemoryBlockstore
  let repo: Repo
  let keypair: crypto.Keypair
  let repoData: RepoContents

  const repoDid = 'did:example:test'

  beforeAll(async () => {
    storage = new MemoryBlockstore()
    keypair = await crypto.Secp256k1Keypair.create()
    repo = await Repo.create(storage, repoDid, keypair)
    syncStorage = new MemoryBlockstore()
    const filled = await util.fillRepo(repo, keypair, 20)
    repo = filled.repo
    repoData = filled.data
  })

  it('sync a non-historical repo checkout', async () => {
    const checkoutCar = await streamToBuffer(
      sync.getCheckout(storage, repo.cid),
    )
    const checkout = await sync.loadCheckout(
      syncStorage,
      checkoutCar,
      repoDid,
      keypair.did(),
    )
    const checkoutRepo = await Repo.load(syncStorage, checkout.root)
    const contents = await checkoutRepo.getContents()
    expect(contents).toEqual(repoData)
    expect(checkout.contents).toEqual(repoData)
  })

  it('does not sync unneeded blocks during checkout', async () => {
    const commitPath = await storage.getCommitPath(repo.cid, null)
    if (!commitPath) {
      throw new Error('Could not get commitPath')
    }
    const hasGenesisCommit = await syncStorage.has(commitPath[0])
    expect(hasGenesisCommit).toBeFalsy()
  })

  it('does not sync duplicate blocks', async () => {
    const carBytes = await streamToBuffer(sync.getCheckout(storage, repo.cid))
    const car = await CarReader.fromBytes(carBytes)
    const cids = new CidSet()
    for await (const block of car.blocks()) {
      if (cids.has(block.cid)) {
        throw new Error(`duplicate block: :${block.cid.toString()}`)
      }
      cids.add(block.cid)
    }
  })

  it('throws on a bad signature', async () => {
    const badRepo = await util.addBadCommit(repo, keypair)
    const checkoutCar = await streamToBuffer(
      sync.getCheckout(storage, badRepo.cid),
    )
    await expect(
      sync.loadCheckout(syncStorage, checkoutCar, repoDid, keypair.did()),
    ).rejects.toThrow(RepoVerificationError)
  })
})
