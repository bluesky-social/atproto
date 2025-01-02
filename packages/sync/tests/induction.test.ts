import { SeedClient, TestNetworkNoAppView, usersSeed } from '@atproto/dev-env'
import { CID } from 'multiformats/cid'
import { Subscription } from '@atproto/xrpc-server'
import * as repo from '@atproto/repo'
import { isValidRepoEvent, RepoOp } from '../src/firehose/lexicons'
import { AtUri } from '@atproto/syntax'

describe('induction', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'sync_induction',
    })
    sc = network.getSeedClient()
    await usersSeed(sc)
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  let alice: string

  it('works', async () => {
    const sub = new Subscription({
      service: network.pds.url.replace('http', 'ws'),
      method: 'com.atproto.sync.subscribeRepos',
      validate: (value: unknown) => {
        return isValidRepoEvent(value)
      },
    })
    const makePosts = async () => {
      const uris: AtUri[] = []
      for (let i = 0; i < 50; i++) {
        const post = await sc.post(alice, 'blah')
        uris.push(post.ref.uri)
      }
      for (const uri of uris) {
        await sc.deletePost(alice, uri)
      }
    }
    const postPromise = makePosts()

    let prev: CID | null = null
    let totalEvts = 0
    for await (const evt of sub) {
      if (evt.$type !== 'com.atproto.sync.subscribeRepos#commit') {
        continue
      }
      const { blocks, root } = await repo.readCarWithRoot(
        evt.blocks as Uint8Array,
      )
      const storage = new repo.MemoryBlockstore(blocks)
      const slice = await repo.Repo.load(storage, root)
      const newDataRoot = await slice.data.getPointer()
      if (prev) {
        let data = slice.data
        const ops = evt.ops as RepoOp[]
        for (const op of ops) {
          if (op.action === 'create') {
            data = await data.delete(op.path)
          } else if (op.action === 'update') {
            data = await data.update(op.path, op.prev)
          } else if (op.action === 'delete') {
            data = await data.add(op.path, op.prev)
          } else {
            throw new Error('unknown action')
          }
        }
        const invertedRoot = await data.getPointer()
        if (!invertedRoot.equals(prev)) {
          throw new Error('bad root')
        }
      }
      prev = newDataRoot
      totalEvts++
      console.log(totalEvts)
      if (totalEvts >= 100) {
        break
      }
    }
    console.log('HERE')
    await postPromise
  })
})
