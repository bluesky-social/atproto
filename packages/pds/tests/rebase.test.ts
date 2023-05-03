import AtpAgent from '@atproto/api'
import * as repo from '@atproto/repo'
import { MemoryBlockstore } from '@atproto/repo'
import { AppContext } from '../src'
import { CloseFn, runTestServer } from './_util'
import { SeedClient } from './seeds/client'

describe('repo rebases', () => {
  let agent: AtpAgent
  let sc: SeedClient
  let alice: string

  let ctx: AppContext

  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'repo_rebase',
    })
    ctx = server.ctx
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await close()
  })

  it('handles rebases', async () => {
    for (let i = 0; i < 40; i++) {
      await sc.post(alice, `post-${i}`)
    }

    const carBefore = await agent.api.com.atproto.sync.getRepo({ did: alice })
    await ctx.db.transaction((dbTxn) =>
      ctx.services.repo(dbTxn).rebaseRepo(alice, new Date().toISOString()),
    )
    const commitPath = await agent.api.com.atproto.sync.getCommitPath({
      did: alice,
    })
    expect(commitPath.data.commits.length).toBe(1)
    const carAfter = await agent.api.com.atproto.sync.getRepo({ did: alice })

    const before = await repo.loadFullRepo(
      new MemoryBlockstore(),
      carBefore.data,
      alice,
      ctx.repoSigningKey.did(),
    )
    const after = await repo.loadFullRepo(
      new MemoryBlockstore(),
      carAfter.data,
      alice,
      ctx.repoSigningKey.did(),
    )
    const contentsBefore = await before.repo.getContents()
    const contentsAfter = await after.repo.getContents()
    expect(contentsAfter).toEqual(contentsBefore)
    expect(after.repo.commit.prev).toBe(null)

    const repoBlobs = await ctx.db.db
      .selectFrom('repo_blob')
      .where('did', '=', alice)
      .selectAll()
      .execute()
    expect(
      repoBlobs.every((row) => row.commit === commitPath[0].tostring()),
    ).toBeTruthy()
  })
})
