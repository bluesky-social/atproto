import { AtpAgent } from '@atproto/api'
import { TID } from '@atproto/common'
import { Keypair, randomStr } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView, usersSeed } from '@atproto/dev-env'
import { RepoRecord } from '@atproto/lexicon'
import * as repo from '@atproto/repo'
import { RepoContents } from '@atproto/repo'

describe('sync listing', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let alice: string
  let aliceKey: Keypair
  const repoData: RepoContents = {}

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'sync_list',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)
    alice = sc.dids.alice
    aliceKey = await network.pds.ctx.actorStore.keypair(alice)
  })

  beforeAll(async () => {
    const collections = [
      'com.example.one.a',
      'com.example.one.b',
      'com.example.two.a',
      'com.example.two.b',
      'com.example.a',
      'com.example.b',
      'com.example.onelong',
      'com.alt.a',
      'com.alt.b',
    ]
    for (const collection of collections) {
      for (let i = 0; i < 3; i++) {
        const record = { $type: collection, test: randomStr(32, 'base32') }
        const rkey = TID.nextStr()
        await agent.com.atproto.repo.createRecord(
          {
            repo: alice,
            collection,
            rkey,
            record,
          },
          { headers: sc.getHeaders(alice) },
        )
        repoData[collection] ??= {}
        repoData[collection][rkey] = record
      }
    }
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const sliceOfRepoData = (collections: string[]): RepoContents => {
    const slice: RepoContents = {}
    for (const collection of collections) {
      slice[collection] = repoData[collection]
    }
    return slice
  }

  const writesToRepoContents = (writes: repo.RecordClaim[]): RepoContents => {
    const contents: RepoContents = {}
    for (const write of writes) {
      contents[write.collection] ??= {}
      contents[write.collection][write.rkey] = write.record as RepoRecord
    }
    return contents
  }

  it('syncs a parital repo by collection', async () => {
    const res = await agent.com.atproto.sync.getRepo({
      did: alice,
      prefix: 'com.example.one.a',
    })
    const writes = await repo.verifyRecords(res.data, alice, aliceKey.did())
    expect(writesToRepoContents(writes)).toEqual(
      sliceOfRepoData(['com.example.one.a']),
    )
  })

  it('syncs a parital repo by namespace', async () => {
    const res = await agent.com.atproto.sync.getRepo({
      did: alice,
      prefix: 'com.example.one',
    })
    const writes = await repo.verifyRecords(res.data, alice, aliceKey.did())
    expect(writesToRepoContents(writes)).toEqual(
      sliceOfRepoData(['com.example.one.a', 'com.example.one.b']),
    )
  })

  it('syncs a parital repo by namespace with multiple levels', async () => {
    const res = await agent.com.atproto.sync.getRepo({
      did: alice,
      prefix: 'com.example',
    })
    const writes = await repo.verifyRecords(res.data, alice, aliceKey.did())
    expect(writesToRepoContents(writes)).toEqual(
      sliceOfRepoData([
        'com.example.one.a',
        'com.example.one.b',
        'com.example.two.a',
        'com.example.two.b',
        'com.example.a',
        'com.example.b',
        'com.example.onelong',
      ]),
    )
  })
})
