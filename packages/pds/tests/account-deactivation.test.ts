import AtpAgent from '@atproto/api'
import { SeedClient, TestNetworkNoAppView, basicSeed } from '@atproto/dev-env'

describe('account deactivation', () => {
  let network: TestNetworkNoAppView

  let sc: SeedClient
  let agent: AtpAgent

  let alice: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_deactivation',
    })

    sc = network.getSeedClient()
    agent = network.pds.getClient()

    await basicSeed(sc)
    alice = sc.dids.alice
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

  it('no longer serves repo data', async () => {
    await expect(
      agent.com.atproto.sync.getRepo({ did: alice }),
    ).rejects.toThrow()
    await expect(
      agent.com.atproto.sync.getLatestCommit({ did: alice }),
    ).rejects.toThrow()
    await expect(
      agent.com.atproto.sync.listBlobs({ did: alice }),
    ).rejects.toThrow()
    const recordUri = sc.posts[alice][0].ref.uri
    await expect(
      agent.com.atproto.sync.getRecord({
        did: alice,
        collection: recordUri.collection,
        rkey: recordUri.rkey,
      }),
    ).rejects.toThrow()
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
    ).rejects.toThrow()

    const blobCid = sc.profiles[alice].avatar.cid
    await expect(
      agent.com.atproto.sync.getBlob({
        did: alice,
        cid: blobCid,
      }),
    ).rejects.toThrow()
    const listedRepos = await agent.com.atproto.sync.listRepos()
    expect(listedRepos.data.repos.find((r) => r.did === alice)).toBeUndefined()
  })

  it('no longer resolves handle', async () => {
    await expect(
      agent.com.atproto.identity.resolveHandle({
        handle: sc.accounts[alice].handle,
      }),
    ).rejects.toThrow()
  })

  it('still allows login', async () => {
    await agent.com.atproto.server.createSession({
      identifier: alice,
      password: sc.accounts[alice].password,
    })
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
  })
})
