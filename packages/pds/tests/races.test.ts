import AtpAgent from '@atproto/api'
import { wait } from '@atproto/common'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { CommitData, readCarWithRoot, verifyRepo } from '@atproto/repo'
import AppContext from '../src/context'
import { PreparedWrite, prepareCreate } from '../src/repo'
import SqlRepoStorage from '../src/sql-repo-storage'
import { ConcurrentWriteError } from '../src/services/repo'

describe('crud operations', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let did: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'races',
    })
    ctx = network.pds.ctx
    agent = network.pds.getClient()
    await agent.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    did = agent.session?.did || ''
  })

  afterAll(async () => {
    await network.close()
  })

  const formatWrite = async () => {
    const write = await prepareCreate({
      did,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'one',
        createdAt: new Date().toISOString(),
      },
      validate: true,
    })
    const storage = new SqlRepoStorage(ctx.db, did)
    const commit = await ctx.services
      .repo(ctx.db)
      .formatCommit(storage, did, [write])
    return { write, commit }
  }

  const processCommitWithWait = async (
    did: string,
    writes: PreparedWrite[],
    commitData: CommitData,
    waitMs: number,
  ) => {
    const now = new Date().toISOString()
    await ctx.db.transaction(async (dbTxn) => {
      const storage = new SqlRepoStorage(dbTxn, did, now)
      const locked = await storage.lockRepo()
      if (!locked) {
        throw new ConcurrentWriteError()
      }
      await wait(waitMs)
      const srvc = ctx.services.repo(dbTxn)
      await Promise.all([
        // persist the commit to repo storage
        storage.applyCommit(commitData),
        // & send to indexing
        srvc.indexWrites(writes, now),
        // do any other processing needed after write
        srvc.afterWriteProcessing(did, commitData, writes),
      ])
    })
  }

  it('handles races in record routes', async () => {
    const { write, commit } = await formatWrite()
    const processPromise = processCommitWithWait(did, [write], commit, 500)

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
      ctx.repoSigningKey.did(),
    )
    expect(verified.creates.length).toBe(2)
    expect(verified.creates[0].cid.equals(write.cid)).toBeTruthy()
    expect(verified.creates[1].cid.toString()).toEqual(
      createdPost.cid.toString(),
    )
  })
})
