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
  let bob: string

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
    await sc.createAccount('bob', {
      email: 'bob@test.com',
      handle: 'bob.test',
      password: 'bob-pass',
    })
    alice = sc.dids.alice
    bob = sc.dids.bob
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
  })

  it('handles blobs that have been rebased away', async () => {
    const file1 = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-landscape-small.jpg',
      'image/jpeg',
    )
    const file2 = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-portrait-small.jpg',
      'image/jpeg',
    )
    const file3Alice = await sc.uploadFile(
      alice,
      'tests/image/fixtures/key-alt.jpg',
      'image/jpeg',
    )
    const file3Bob = await sc.uploadFile(
      bob,
      'tests/image/fixtures/key-alt.jpg',
      'image/jpeg',
    )

    const post1 = await sc.post(alice, 'first post', undefined, [file1])
    await sc.post(alice, 'second post', undefined, [file2])
    const post3 = await sc.post(alice, 'third post', undefined, [file3Alice])
    await sc.post(bob, 'bob post', undefined, [file3Bob])
    await sc.deletePost(alice, post1.ref.uri)
    await sc.deletePost(alice, post3.ref.uri)

    await ctx.db.transaction((dbTxn) =>
      ctx.services.repo(dbTxn).rebaseRepo(alice, new Date().toISOString()),
    )

    const repoBlobs = await ctx.db.db
      .selectFrom('repo_blob')
      .where('did', '=', alice)
      .selectAll()
      .execute()
    const repoBlobCids = repoBlobs.map((row) => row.cid)
    expect(repoBlobCids).toEqual([file2.image.ref.toString()])
    const blobs = await ctx.db.db
      .selectFrom('blob')
      .where('creator', '=', alice)
      .selectAll()
      .execute()
    const blobCids = blobs.map((row) => row.cid)

    expect(blobCids).toEqual([file2.image.ref.toString()])
    const has1 = await ctx.blobstore.hasStored(file1.image.ref)
    expect(has1).toBe(false)
    const has2 = await ctx.blobstore.hasStored(file2.image.ref)
    expect(has2).toBe(true)
    const has3 = await ctx.blobstore.hasStored(file3Bob.image.ref)
    expect(has3).toBe(true)
  })
})
