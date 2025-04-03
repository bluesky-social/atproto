import { TID, streamToBuffer } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { RepoRecord } from '@atproto/lexicon'
import { RecordClaim, Repo, RepoContents, WriteOpAction } from '../src'
import { MemoryBlockstore } from '../src/storage'
import * as sync from '../src/sync'

describe('Partial Sync', () => {
  let storage: MemoryBlockstore
  let repo: Repo
  let keypair: crypto.Keypair
  const repoData: RepoContents = {}

  const repoDid = 'did:example:test'

  const collections = [
    'com.example.one.a',
    'com.example.one.b',
    'com.example.two.a',
    'com.example.two.b',
    'com.example.a',
    'com.example.b',
    'com.examplelong',
    'com.alt.a',
    'com.alt.b',
  ]

  beforeAll(async () => {
    storage = new MemoryBlockstore()
    keypair = await crypto.Secp256k1Keypair.create()
    repo = await Repo.create(storage, repoDid, keypair)

    for (const collection of collections) {
      for (let i = 0; i < 3; i++) {
        const record = { test: crypto.randomStr(32, 'base32') }
        const rkey = TID.nextStr()
        repo = await repo.applyWrites(
          [{ action: WriteOpAction.Create, collection, rkey, record }],
          keypair,
        )
        repoData[collection] ??= {}
        repoData[collection][rkey] = record
      }
    }
  })

  const sliceOfRepoData = (collections: string[]): RepoContents => {
    const slice: RepoContents = {}
    for (const collection of collections) {
      slice[collection] = repoData[collection]
    }
    return slice
  }

  const writesToRepoContents = (writes: RecordClaim[]): RepoContents => {
    const contents: RepoContents = {}
    for (const write of writes) {
      contents[write.collection] ??= {}
      contents[write.collection][write.rkey] = write.record as RepoRecord
    }
    return contents
  }

  it('sync a partial repo by collection', async () => {
    const carBytes = await streamToBuffer(
      sync.getPartialRepo(storage, repo.cid, 'com.example.one.a'),
    )
    const verified = await sync.verifyRecords(carBytes, repoDid, keypair.did())
    expect(writesToRepoContents(verified)).toEqual(
      sliceOfRepoData(['com.example.one.a']),
    )
  })

  it('sync a partial repo by namespace', async () => {
    const carBytes = await streamToBuffer(
      sync.getPartialRepo(storage, repo.cid, 'com.example.one'),
    )
    const verified = await sync.verifyRecords(carBytes, repoDid, keypair.did())
    expect(writesToRepoContents(verified)).toEqual(
      sliceOfRepoData(['com.example.one.a', 'com.example.one.b']),
    )
  })

  it('sync a partial repo by namespace with multiple levels', async () => {
    const carBytes = await streamToBuffer(
      sync.getPartialRepo(storage, repo.cid, 'com.example'),
    )
    const verified = await sync.verifyRecords(carBytes, repoDid, keypair.did())
    expect(writesToRepoContents(verified)).toEqual(
      sliceOfRepoData([
        'com.example.one.a',
        'com.example.one.b',
        'com.example.two.a',
        'com.example.two.b',
        'com.example.a',
        'com.example.b',
      ]),
    )
  })
})
