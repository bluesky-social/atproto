import { AtpAgent } from '@atproto/api'
import {
  ImageRef,
  SeedClient,
  TestNetworkNoAppView,
  basicSeed,
} from '@atproto/dev-env'

describe('account deactivation', () => {
  let network: TestNetworkNoAppView

  let sc: SeedClient
  let agent: AtpAgent

  let alice: string
  let aliceAvatar: ImageRef

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_deactivation',
    })

    sc = network.getSeedClient()
    agent = network.pds.getClient()

    await basicSeed(sc)
    alice = sc.dids.alice

    aliceAvatar = await sc.uploadFile(
      alice,
      '../dev-env/assets/key-portrait-small.jpg',
      'image/jpeg',
    )
    await sc.updateProfile(alice, {
      avatar: aliceAvatar.image,
    })

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('deactivates account', async () => {
    await agent.com.atproto.server.deactivateAccount(
      {},
      { encoding: 'application/json', headers: sc.getHeaders(alice) },
    )
  })

  it('returns deactivated status', async () => {
    const res = await agent.com.atproto.sync.getRepoStatus({ did: alice })
    expect(res.data).toEqual({
      did: alice,
      active: false,
      status: 'deactivated',
    })

    const adminRes = await agent.com.atproto.admin.getAccountInfo(
      {
        did: alice,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(typeof adminRes.data.deactivatedAt).toBeDefined()
  })

  it('no longer serves repo data', async () => {
    await expect(
      agent.com.atproto.sync.getRepo({ did: alice }),
    ).rejects.toThrow(/Repo has been deactivated/)
    await expect(
      agent.com.atproto.sync.getLatestCommit({ did: alice }),
    ).rejects.toThrow(/Repo has been deactivated/)
    await expect(
      agent.com.atproto.sync.listBlobs({ did: alice }),
    ).rejects.toThrow(/Repo has been deactivated/)
    const recordUri = sc.posts[alice][0].ref.uri
    await expect(
      agent.com.atproto.sync.getRecord({
        did: alice,
        collection: recordUri.collection,
        rkey: recordUri.rkey,
      }),
    ).rejects.toThrow(/Repo has been deactivated/)
    await expect(
      agent.com.atproto.repo.getRecord({
        repo: alice,
        collection: recordUri.collection,
        rkey: recordUri.rkey,
      }),
    ).rejects.toThrow()
    await expect(
      agent.com.atproto.repo.describeRepo({
        repo: alice,
      }),
    ).rejects.toThrow(/Repo has been deactivated/)

    await expect(
      agent.com.atproto.sync.getBlob({
        did: alice,
        cid: aliceAvatar.image.ref.toString(),
      }),
    ).rejects.toThrow(/Repo has been deactivated/)
    const listedRepos = await agent.com.atproto.sync.listRepos()
    const listedAlice = listedRepos.data.repos.find((r) => r.did === alice)
    expect(listedAlice?.active).toBe(false)
    expect(listedAlice?.status).toBe('deactivated')
  })

  it('no longer resolves handle', async () => {
    await expect(
      agent.com.atproto.identity.resolveHandle({
        handle: sc.accounts[alice].handle,
      }),
    ).rejects.toThrow()
  })

  it('still allows login and returns status', async () => {
    const res = await agent.com.atproto.server.createSession({
      identifier: alice,
      password: sc.accounts[alice].password,
    })
    expect(res.data.status).toEqual('deactivated')
  })

  it('returns status on getSession', async () => {
    const res = await agent.com.atproto.server.getSession(undefined, {
      headers: sc.getHeaders(alice),
    })
    expect(res.data.status).toEqual('deactivated')
  })

  it('does not allow writes', async () => {
    const createAttempt = agent.com.atproto.repo.createRecord(
      {
        repo: alice,
        collection: 'app.bsky.feed.post',
        record: {
          text: 'blah',
          createdAt: new Date().toISOString(),
        },
      },
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      },
    )
    const uri = sc.posts[alice][0].ref.uri
    await expect(createAttempt).rejects.toThrow('Account is deactivated')

    const putAttempt = agent.com.atproto.repo.putRecord(
      {
        repo: alice,
        collection: uri.collection,
        rkey: uri.rkey,
        record: {
          text: 'blah',
          createdAt: new Date().toISOString(),
        },
      },
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      },
    )
    await expect(putAttempt).rejects.toThrow('Account is deactivated')

    const deleteAttempt = agent.com.atproto.repo.deleteRecord(
      {
        repo: alice,
        collection: uri.collection,
        rkey: uri.rkey,
      },
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      },
    )
    await expect(deleteAttempt).rejects.toThrow('Account is deactivated')
  })

  it('reactivates', async () => {
    await agent.com.atproto.server.activateAccount(undefined, {
      headers: sc.getHeaders(alice),
    })

    await agent.com.atproto.sync.getRepo({ did: alice })

    const statusRes = await agent.com.atproto.sync.getRepoStatus({ did: alice })
    expect(statusRes.data.active).toBe(true)
    expect(statusRes.data.status).toBeUndefined()

    const adminRes = await agent.com.atproto.admin.getAccountInfo(
      {
        did: alice,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(adminRes.data.deactivatedAt).toBeUndefined()
  })
})
