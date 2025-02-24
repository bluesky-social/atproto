import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/api'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import * as repo from '@atproto/repo'
import { Subscription } from '@atproto/xrpc-server'
import {
  OutputSchema as SubscribeReposOutput,
  RepoOp,
  isCommit,
} from '../../src/lexicon/types/com/atproto/sync/subscribeRepos'
import basicSeed from '../seeds/basic'

describe('invertible ops', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'repo_invertible_ops',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)

    let posts: AtUri[] = []
    for (let i = 0; i < 20; i++) {
      const [aliceRef, bobRef, carolRef, danRef] = await Promise.all([
        sc.post(sc.dids.alice, 'test'),
        sc.post(sc.dids.bob, 'test'),
        sc.post(sc.dids.carol, 'test'),
        sc.post(sc.dids.dan, 'test'),
      ])
      posts = [
        ...posts,
        aliceRef.ref.uri,
        bobRef.ref.uri,
        carolRef.ref.uri,
        danRef.ref.uri,
      ]
    }
    for (const post of posts) {
      await sc.deletePost(post.hostname, post)
    }

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('works', async () => {
    const currSeq = (await network.pds.ctx.sequencer.curr()) ?? 0

    const sub = new Subscription({
      service: network.pds.url.replace('http://', 'ws://'),
      method: 'com.atproto.sync.subscribeRepos',
      validate: (value: unknown): SubscribeReposOutput => {
        return value as any
      },
      getParams: () => {
        return { cursor: 0 }
      },
    })

    for await (const evt of sub) {
      if (!isCommit(evt)) {
        continue
      }
      const prevData = evt.prevData as CID | undefined
      if (!prevData) {
        continue
      }

      const { blocks, root } = await repo.readCarWithRoot(
        evt.blocks as Uint8Array,
      )
      const storage = new repo.MemoryBlockstore(blocks)
      const slice = await repo.Repo.load(storage, root)

      let data = slice.data
      const ops = evt.ops as RepoOp[]
      for (const op of ops) {
        if (op.action === 'create') {
          data = await data.delete(op.path)
        } else if (op.action === 'update') {
          if (!op.prev) throw new Error('missing prev')
          data = await data.update(op.path, op.prev)
        } else if (op.action === 'delete') {
          if (!op.prev) throw new Error('missing prev')
          data = await data.add(op.path, op.prev)
        } else {
          throw new Error('unknown action')
        }
      }

      const invertedRoot = await data.getPointer()
      expect(invertedRoot.equals(prevData)).toBe(true)

      if (evt.seq >= currSeq) {
        break
      }
    }
  })
})
