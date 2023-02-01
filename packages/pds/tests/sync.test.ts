import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { TID } from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import { DidResolver } from '@atproto/did-resolver'
import * as repo from '@atproto/repo'
import { collapseWriteLog, MemoryBlockstore } from '@atproto/repo'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import { CloseFn, runTestServer } from './_util'

describe.skip('repo sync', () => {
  let client: AtpServiceClient
  let did: string

  const repoData: repo.RepoContents = {}
  const uris: AtUri[] = []
  const storage = new MemoryBlockstore()
  let didResolver: DidResolver
  let currRoot: CID | undefined

  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'repo_sync',
    })
    close = server.close
    client = AtpApi.service(server.url)
    const res = await client.com.atproto.account.create({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    client.setHeader('authorization', `Bearer ${res.data.accessJwt}`)
    did = res.data.did
    didResolver = new DidResolver({ plcUrl: server.ctx.cfg.didPlcUrl })
    repoData['app.bsky.system.declaration'] = {
      self: {
        $type: 'app.bsky.system.declaration',
        actorType: 'app.bsky.system.actorUser',
      },
    }
  })

  afterAll(async () => {
    await close()
  })

  it('creates and syncs some records', async () => {
    const ADD_COUNT = 10
    for (let i = 0; i < ADD_COUNT; i++) {
      const { obj, uri } = await makePost(client, did)
      if (!repoData[uri.collection]) {
        repoData[uri.collection] = {}
      }
      repoData[uri.collection][uri.rkey] = obj
      uris.push(uri)
    }

    const car = await client.com.atproto.sync.getRepo({ did })
    const synced = await repo.loadFullRepo(
      storage,
      new Uint8Array(car.data),
      didResolver,
    )
    expect(synced.writeLog.length).toBe(ADD_COUNT + 1) // +1 because of declaration
    const ops = await collapseWriteLog(synced.writeLog)
    expect(ops.length).toBe(ADD_COUNT + 1)
    const loaded = await repo.Repo.load(storage, synced.root)
    const contents = await loaded.getContents()
    expect(contents).toEqual(repoData)

    currRoot = synced.root
  })

  it('syncs creates and deletes', async () => {
    const ADD_COUNT = 10
    const DEL_COUNT = 4
    for (let i = 0; i < ADD_COUNT; i++) {
      const { obj, uri } = await makePost(client, did)
      if (!repoData[uri.collection]) {
        repoData[uri.collection] = {}
      }
      repoData[uri.collection][uri.rkey] = obj
      uris.push(uri)
    }
    // delete two that are already sync & two that have not been
    for (let i = 0; i < DEL_COUNT; i++) {
      const uri = uris[i * 5]
      await client.app.bsky.feed.post.delete({
        did,
        colleciton: uri.collection,
        rkey: uri.rkey,
      })
      delete repoData[uri.collection][uri.rkey]
    }

    const car = await client.com.atproto.sync.getRepo({
      did,
      from: currRoot?.toString(),
    })
    const currRepo = await repo.Repo.load(storage, currRoot)
    const synced = await repo.loadDiff(
      currRepo,
      new Uint8Array(car.data),
      didResolver,
    )
    expect(synced.writeLog.length).toBe(ADD_COUNT + DEL_COUNT)
    const ops = await collapseWriteLog(synced.writeLog)
    expect(ops.length).toBe(ADD_COUNT) // -2 because of dels of new records, +2 because of dels of old records
    const loaded = await repo.Repo.load(storage, synced.root)
    const contents = await loaded.getContents()
    expect(contents).toEqual(repoData)

    currRoot = synced.root
  })

  it('syncs current root', async () => {
    const root = await client.com.atproto.sync.getHead({ did })
    expect(root.data.root).toEqual(currRoot?.toString())
  })

  it('syncs commit path', async () => {
    const local = await storage.getCommitPath(currRoot as CID, null)
    if (!local) {
      throw new Error('Could not get local commit path')
    }
    const localStr = local.map((c) => c.toString())
    const commitPath = await client.com.atproto.sync.getCommitPath({ did })
    expect(commitPath.data.commits).toEqual(localStr)

    const partialCommitPath = await client.com.atproto.sync.getCommitPath({
      did,
      earliest: localStr[2],
      latest: localStr[15],
    })
    expect(partialCommitPath.data.commits).toEqual(localStr.slice(3, 16))
  })

  it('sync a repo checkout', async () => {
    const car = await client.com.atproto.sync.getCheckout({ did })
    const checkoutStorage = new MemoryBlockstore()
    const loaded = await repo.loadCheckout(
      checkoutStorage,
      new Uint8Array(car.data),
      didResolver,
    )
    expect(loaded.contents).toEqual(repoData)
    const loadedRepo = await repo.Repo.load(checkoutStorage, loaded.root)
    expect(await loadedRepo.getContents()).toEqual(repoData)
  })

  it('sync a record proof', async () => {
    const collection = Object.keys(repoData)[0]
    const rkey = Object.keys(repoData[collection])[0]
    const car = await client.com.atproto.sync.getRecord({
      did,
      collection,
      rkey,
    })
    const records = await repo.verifyRecords(
      did,
      new Uint8Array(car.data),
      didResolver,
    )
    const claim = {
      collection,
      rkey,
      record: repoData[collection][rkey],
    }
    expect(records.length).toBe(1)
    expect(records[0].record).toEqual(claim.record)
    const result = await repo.verifyProofs(
      did,
      new Uint8Array(car.data),
      [claim],
      didResolver,
    )
    expect(result.verified.length).toBe(1)
    expect(result.unverified.length).toBe(0)
  })

  it('sync a proof of non-existence', async () => {
    const collection = Object.keys(repoData)[0]
    const rkey = TID.nextStr() // rkey that doesn't exist
    const car = await client.com.atproto.sync.getRecord({
      did,
      collection,
      rkey,
    })
    const claim = {
      collection,
      rkey,
      record: null,
    }
    const result = await repo.verifyProofs(
      did,
      new Uint8Array(car.data),
      [claim],
      didResolver,
    )
    expect(result.verified.length).toBe(1)
    expect(result.unverified.length).toBe(0)
  })
})

const makePost = async (client: AtpServiceClient, did: string) => {
  const obj = {
    $type: 'app.bsky.feed.post',
    text: randomStr(32, 'base32'),
    createdAt: new Date().toISOString(),
  }
  const res = await client.app.bsky.feed.post.create({ did }, obj)
  const uri = new AtUri(res.uri)
  return { obj, uri }
}
