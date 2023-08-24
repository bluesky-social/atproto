import AtpAgent from '@atproto/api'
import { CloseFn, runTestServer } from './_util'
import AppContext from '../src/context'
import { PreparedWrite, prepareCreate } from '../src/repo'
import { wait } from '@atproto/common'
import SqlRepoStorage from '../src/sql-repo-storage'
import { CommitData, MemoryBlockstore, loadFullRepo } from '@atproto/repo'
import { ConcurrentWriteError } from '../src/services/repo'

describe('crud operations', () => {
  let ctx: AppContext
  let agent: AtpAgent
  let did: string
  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'races',
    })
    ctx = server.ctx
    close = server.close
    agent = new AtpAgent({ service: server.url })
    await agent.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    did = agent.session?.did || ''
  })

  afterAll(async () => {
    await close()
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

    const repoCar = await agent.api.com.atproto.sync.getRepo({ did })
    const storage = new MemoryBlockstore()
    const verified = await loadFullRepo(
      storage,
      repoCar.data,
      did,
      ctx.repoSigningKey.did(),
    )
    // it split writes over 2 commits
    expect(verified.writeLog[1].length).toBe(1)
    expect(verified.writeLog[2].length).toBe(1)
    expect(verified.writeLog[1][0].cid.equals(write.cid)).toBeTruthy()
    expect(verified.writeLog[2][0].cid.toString()).toEqual(
      createdPost.cid.toString(),
    )
  })
})
