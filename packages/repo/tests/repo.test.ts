import * as crypto from '@atproto/crypto'
import { Repo } from '../src/repo'
import { MemoryBlockstore } from '../src/storage'
import * as util from './_util'
import { TID } from '@atproto/common'
import { RepoContents, WriteOpAction } from '../src'
import { Secp256k1Keypair } from '@atproto/crypto'

describe('Repo', () => {
  const collName = 'com.example.posts'

  let storage: MemoryBlockstore
  let keypair: crypto.Keypair
  let repo: Repo
  let repoData: RepoContents

  it('creates repo', async () => {
    storage = new MemoryBlockstore()
    keypair = await Secp256k1Keypair.create()
    repo = await Repo.create(storage, keypair.did(), keypair)
  })

  it('has proper metadata', async () => {
    expect(repo.meta.did).toEqual(keypair.did())
    expect(repo.meta.version).toBe(1)
    expect(repo.meta.datastore).toBe('mst')
  })

  it('does basic operations', async () => {
    const rkey = TID.nextStr()
    const record = util.generateObject()
    repo = await repo.applyWrites(
      {
        action: WriteOpAction.Create,
        collection: collName,
        rkey,
        record,
      },
      keypair,
    )

    let got = await repo.getRecord(collName, rkey)
    expect(got).toEqual(record)

    const updatedRecord = util.generateObject()
    repo = await repo.applyWrites(
      {
        action: WriteOpAction.Update,
        collection: collName,
        rkey,
        record: updatedRecord,
      },
      keypair,
    )
    got = await repo.getRecord(collName, rkey)
    expect(got).toEqual(updatedRecord)

    repo = await repo.applyWrites(
      {
        action: WriteOpAction.Delete,
        collection: collName,
        rkey: rkey,
      },
      keypair,
    )
    got = await repo.getRecord(collName, rkey)
    expect(got).toBeNull()
  })

  it('adds content collections', async () => {
    const filled = await util.fillRepo(repo, keypair, 100)
    repo = filled.repo
    repoData = filled.data
    const contents = await repo.getContents()
    expect(contents).toEqual(repoData)
  })

  it('edits and deletes content', async () => {
    const edited = await util.editRepo(repo, repoData, keypair, {
      adds: 20,
      updates: 20,
      deletes: 20,
    })
    repo = edited.repo
    const contents = await repo.getContents()
    expect(contents).toEqual(repoData)
  })

  it('adds a valid signature to commit', async () => {
    const commit = await repo.commit
    const verified = await crypto.verifySignature(
      repo.did,
      commit.root.bytes,
      commit.sig,
    )
    expect(verified).toBeTruthy()
  })

  it('sets correct DID', async () => {
    expect(repo.did).toEqual(await keypair.did())
  })

  it('loads from blockstore', async () => {
    const reloadedRepo = await Repo.load(storage, repo.cid)

    const contents = await reloadedRepo.getContents()
    expect(contents).toEqual(repoData)
    expect(repo.meta.did).toEqual(keypair.did())
    expect(repo.meta.version).toBe(1)
    expect(repo.meta.datastore).toBe('mst')
  })
})
