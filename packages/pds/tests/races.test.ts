import { AtpAgent } from '@atproto/api'
import { wait } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { readCarWithRoot, verifyRepo } from '@atproto/repo'
import { AppContext } from '../src/context'
import { PreparedCreate, prepareCreate } from '../src/repo'

describe('races', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let did: string
  let signingKey: Keypair

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'races',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    agent = network.pds.getClient()
    await agent.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    did = agent.accountDid
    signingKey = await network.pds.ctx.actorStore.keypair(did)
  })

  afterAll(async () => {
    await network.close()
  })

  const processCommitWithWait = async (
    did: string,
    write: PreparedCreate,
    waitMs: number,
  ) => {
    const now = new Date().toISOString()
    return ctx.actorStore.transact(did, async (store) => {
      const commitData = await store.repo.formatCommit([write])
      await store.repo.storage.applyCommit(commitData)
      await wait(waitMs)
      await store.repo.indexWrites([write], now)
      return write
    })
  }

  it('handles races in record routes', async () => {
    const write = await prepareCreate({
      did,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'one',
        createdAt: new Date().toISOString(),
      },
      validate: true,
    })

    const processPromise = processCommitWithWait(did, write, 500)

    const createdPost = await agent.api.app.bsky.feed.post.create(
      { repo: did },
      { text: 'two', createdAt: new Date().toISOString() },
    )

    await processPromise

    const listed = await agent.api.app.bsky.feed.post.list({ repo: did })
    expect(listed.records.length).toBe(2)

    const carRes = await agent.api.com.atproto.sync.getRepo({ did })
    const car = await readCarWithRoot(carRes.data)
    const verified = await verifyRepo(
      car.blocks,
      car.root,
      did,
      signingKey.did(),
    )
    expect(verified.creates.length).toBe(2)
    expect(verified.creates[0].cid.toString()).toEqual(write.cid.toString())
    expect(verified.creates[1].cid.toString()).toEqual(
      createdPost.cid.toString(),
    )
  })
})
