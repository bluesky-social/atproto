import { SeedClient, TestNetworkNoAppView, basicSeed } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { DidString } from '@atproto/syntax'
import { app, com } from '../src'

describe('account deactivation', () => {
  let network: TestNetworkNoAppView

  let sc: SeedClient
  let client: Client

  let alice: DidString
  let aliceAvatar: app.bsky.embed.images.Image

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_deactivation',
    })

    sc = network.getSeedClient()
    client = network.pds.getClient()

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
    await client.call(
      com.atproto.server.deactivateAccount,
      {},
      { headers: sc.getHeaders(alice) },
    )
  })

  it('returns deactivated status', async () => {
    const res = await client.call(com.atproto.sync.getRepoStatus, {
      did: alice,
    })
    expect(res).toEqual({
      did: alice,
      active: false,
      status: 'deactivated',
    })

    const adminRes = await client.call(
      com.atproto.admin.getAccountInfo,
      {
        did: alice,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(typeof adminRes.deactivatedAt).toBeDefined()
  })

  it('no longer serves repo data', async () => {
    await expect(
      client.call(com.atproto.sync.getRepo, { did: alice }),
    ).rejects.toThrow(/Repo has been deactivated/)
    await expect(
      client.call(com.atproto.sync.getLatestCommit, { did: alice }),
    ).rejects.toThrow(/Repo has been deactivated/)
    await expect(
      client.call(com.atproto.sync.listBlobs, { did: alice }),
    ).rejects.toThrow(/Repo has been deactivated/)
    const recordUri = sc.posts[alice][0].ref.uri
    await expect(
      client.call(com.atproto.sync.getRecord, {
        did: alice,
        collection: recordUri.collection,
        rkey: recordUri.rkey,
      }),
    ).rejects.toThrow(/Repo has been deactivated/)
    await expect(
      client.call(com.atproto.repo.getRecord, {
        repo: alice,
        collection: recordUri.collection,
        rkey: recordUri.rkey,
      }),
    ).rejects.toThrow()
    await expect(
      client.call(com.atproto.repo.describeRepo, {
        repo: alice,
      }),
    ).rejects.toThrow(/Repo has been deactivated/)

    await expect(
      client.call(com.atproto.sync.getBlob, {
        did: alice,
        cid: aliceAvatar.image.ref.toString(),
      }),
    ).rejects.toThrow(/Repo has been deactivated/)
    const listedRepos = await client.call(com.atproto.sync.listRepos)
    const listedAlice = listedRepos.repos.find((r) => r.did === alice)
    expect(listedAlice?.active).toBe(false)
    expect(listedAlice?.status).toBe('deactivated')
  })

  it('no longer resolves handle', async () => {
    await expect(
      client.call(com.atproto.identity.resolveHandle, {
        handle: sc.accounts[alice].handle,
      }),
    ).rejects.toThrow()
  })

  it('still allows login and returns status', async () => {
    const res = await client.call(com.atproto.server.createSession, {
      identifier: alice,
      password: sc.accounts[alice].password,
    })
    expect(res.status).toEqual('deactivated')
  })

  it('returns status on getSession', async () => {
    const res = await client.call(
      com.atproto.server.getSession,
      {},
      {
        headers: sc.getHeaders(alice),
      },
    )
    expect(res.status).toEqual('deactivated')
  })

  it('does not allow writes', async () => {
    const createAttempt = client.call(
      com.atproto.repo.createRecord,
      {
        repo: alice,
        collection: 'app.bsky.feed.post',
        record: {
          text: 'blah',
          createdAt: new Date().toISOString(),
        },
      },
      {
        headers: sc.getHeaders(alice),
      },
    )
    const uri = sc.posts[alice][0].ref.uri
    await expect(createAttempt).rejects.toThrow('Account is deactivated')

    const putAttempt = client.call(
      com.atproto.repo.putRecord,
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
        headers: sc.getHeaders(alice),
      },
    )
    await expect(putAttempt).rejects.toThrow('Account is deactivated')

    const deleteAttempt = client.call(
      com.atproto.repo.deleteRecord,
      {
        repo: alice,
        collection: uri.collection,
        rkey: uri.rkey,
      },
      {
        headers: sc.getHeaders(alice),
      },
    )
    await expect(deleteAttempt).rejects.toThrow('Account is deactivated')
  })

  it('reactivates', async () => {
    await client.call(com.atproto.server.activateAccount, undefined, {
      headers: sc.getHeaders(alice),
    })

    await client.call(com.atproto.sync.getRepo, { did: alice })

    const statusRes = await client.call(com.atproto.sync.getRepoStatus, {
      did: alice,
    })
    expect(statusRes.active).toBe(true)
    expect(statusRes.status).toBeUndefined()

    const adminRes = await client.call(
      com.atproto.admin.getAccountInfo,
      {
        did: alice,
      },
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(adminRes.deactivatedAt).toBeUndefined()
  })
})
