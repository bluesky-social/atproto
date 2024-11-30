import * as crypto from '@atproto/crypto'
import {
  CidSet,
  Repo,
  RepoContents,
  RepoVerificationError,
  getAndParseRecord,
  readCarWithRoot,
} from '../src'
import { MemoryBlockstore } from '../src/storage'
import * as sync from '../src/sync'

import * as util from './_util'
import { streamToBuffer } from '@atproto/common'
import { CarReader } from '@ipld/car/reader'

describe('Repo Sync', () => {
  let storage: MemoryBlockstore
  let repo: Repo
  let keypair: crypto.Keypair
  let repoData: RepoContents

  const repoDid = 'did:example:test'

  beforeAll(async () => {
    storage = new MemoryBlockstore()
    keypair = await crypto.Secp256k1Keypair.create()
    repo = await Repo.create(storage, repoDid, keypair)
    const filled = await util.fillRepo(repo, keypair, 20)
    repo = filled.repo
    repoData = filled.data
  })

  it('sync a full repo', async () => {
    const carBytes = await streamToBuffer(sync.getFullRepo(storage, repo.cid))
    const car = await readCarWithRoot(carBytes)
    const verified = await sync.verifyRepo(
      car.blocks,
      car.root,
      repoDid,
      keypair.did(),
    )
    const syncStorage = new MemoryBlockstore()
    await syncStorage.applyCommit(verified.commit)
    const loadedRepo = await Repo.load(syncStorage, car.root)
    const contents = await loadedRepo.getContents()
    expect(contents).toEqual(repoData)
    const contentsFromOps: RepoContents = {}
    for (const write of verified.creates) {
      contentsFromOps[write.collection] ??= {}
      const parsed = await getAndParseRecord(car.blocks, write.cid)
      contentsFromOps[write.collection][write.rkey] = parsed.record
    }
    expect(contentsFromOps).toEqual(repoData)
  })

  it('does not sync duplicate blocks', async () => {
    const carBytes = await streamToBuffer(sync.getFullRepo(storage, repo.cid))
    const car = await CarReader.fromBytes(carBytes)
    const cids = new CidSet()
    for await (const block of car.blocks()) {
      if (cids.has(block.cid)) {
        throw new Error(`duplicate block: :${block.cid.toString()}`)
      }
      cids.add(block.cid)
    }
  })

  it('syncs a repo that is behind', async () => {
    // add more to providers's repo & have consumer catch up
    const edit = await util.formatEdit(repo, repoData, keypair, {
      adds: 10,
      updates: 10,
      deletes: 10,
    })
    const verified = await sync.verifyDiff(
      repo,
      edit.commit.newBlocks,
      edit.commit.cid,
      repoDid,
      keypair.did(),
    )
    await storage.applyCommit(verified.commit)
    repo = await Repo.load(storage, verified.commit.cid)
    const contents = await repo.getContents()
    expect(contents).toEqual(edit.data)
  })

  it('throws on a bad signature', async () => {
    const badRepo = await util.addBadCommit(repo, keypair)
    const carBytes = await streamToBuffer(
      sync.getFullRepo(storage, badRepo.cid),
    )
    const car = await readCarWithRoot(carBytes)
    await expect(
      sync.verifyRepo(car.blocks, car.root, repoDid, keypair.did()),
    ).rejects.toThrow(RepoVerificationError)
  })
})
