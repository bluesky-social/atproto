import * as auth from '@atproto/auth'
import { TID } from '@atproto/common'
import { MemoryBlockstore, Repo } from '../src'
import * as util from '../tests/_util'

describe('Repo Benchmarks', () => {
  const verifier = new auth.Verifier()
  const size = 10000

  let blockstore: MemoryBlockstore
  let authStore: auth.AuthStore
  let repo: Repo

  beforeAll(async () => {
    blockstore = new MemoryBlockstore()
    authStore = await verifier.createTempAuthStore()
    await authStore.claimFull()
    repo = await Repo.create(blockstore, await authStore.did(), authStore)
  })

  it('calculates size', async () => {
    for (let i = 0; i < size; i++) {
      if (i % 500 === 0) {
        console.log(i)
      }
      await repo
        .stageUpdate({
          action: 'create',
          collection: 'app.bsky.post',
          rkey: TID.nextStr(),
          value: {
            $type: 'app.bsky.post',
            text: util.randomStr(150),
            reply: {
              root: 'at://did:plc:1234abdefeoi23/app.bsky.post/12345678912345',
              parent:
                'at://did:plc:1234abdefeoi23/app.bsky.post/12345678912345',
            },
            createdAt: new Date().toISOString(),
          },
        })
        .createCommit(authStore)
    }

    console.log('SIZE: ', await blockstore.sizeInBytes())
  })
})
