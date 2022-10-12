import * as auth from '@adxp/auth'

import { Repo } from '../src/repo'
import { MemoryBlockstore } from '../src/blockstore'
import * as util from './_util'

describe('Repo', () => {
  const verifier = new auth.Verifier()

  let blockstore: MemoryBlockstore
  let authStore: auth.AuthStore
  let repo: Repo
  let repoData: util.RepoData

  it('creates repo', async () => {
    blockstore = new MemoryBlockstore()
    authStore = await verifier.createTempAuthStore()
    await authStore.claimFull()
    repo = await Repo.create(blockstore, await authStore.did(), authStore)
  })

  it('does basic operations', async () => {
    const collection = repo.getCollection('com.example.posts')

    const obj = util.generateObject()
    const { key } = await collection.createRecord(obj)
    let got = await collection.getRecord(key)
    expect(got).toEqual(obj)

    const updatedObj = util.generateObject()
    await collection.updateRecord(key, updatedObj)
    got = await collection.getRecord(key)
    expect(got).toEqual(updatedObj)

    await collection.deleteRecord(key)
    got = await collection.getRecord(key)
    expect(got).toBeNull()
  })

  it('adds content collections', async () => {
    repoData = await util.fillRepo(repo, 100)
    await util.checkRepo(repo, repoData)
  })

  it('edits and deletes content', async () => {
    repoData = await util.editRepo(repo, repoData, {
      adds: 20,
      updates: 20,
      deletes: 20,
    })
    await util.checkRepo(repo, repoData)
  })

  it('adds a valid signature to commit', async () => {
    const commit = await repo.getCommit()
    const verified = await verifier.verifySignature(
      repo.did(),
      commit.root.bytes,
      commit.sig,
    )
    expect(verified).toBeTruthy()
  })

  it('sets correct DID', async () => {
    expect(repo.did()).toEqual(await authStore.did())
  })

  it('loads from blockstore', async () => {
    const reloadedRepo = await Repo.load(
      blockstore,
      repo.cid,
      verifier,
      authStore,
    )

    await util.checkRepo(reloadedRepo, repoData)
  })
})
