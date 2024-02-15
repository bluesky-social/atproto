import AtpAgent from '@atproto/api'
import { HOUR } from '@atproto/common'
import {
  SeedClient,
  TestNetworkNoAppView,
  TestPds,
  mockNetworkUtilities,
} from '@atproto/dev-env'

describe('account migration', () => {
  let network: TestNetworkNoAppView
  let newPds: TestPds

  let sc: SeedClient
  let oldAgent: AtpAgent
  let newAgent: AtpAgent

  let alice: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_migration',
    })
    newPds = await TestPds.create({
      didPlcUrl: network.plc.url,
    })
    mockNetworkUtilities(newPds)

    sc = network.getSeedClient()
    oldAgent = network.pds.getClient()
    newAgent = newPds.getClient()

    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    alice = sc.dids.alice

    for (let i = 0; i < 100; i++) {
      await sc.post(alice, 'test post')
    }
    const img1 = await sc.uploadFile(
      alice,
      '../dev-env/src/seed/img/at.png',
      'image/png',
    )
    const img2 = await sc.uploadFile(
      alice,
      '../dev-env/src/seed/img/key-alt.jpg',
      'image/jpeg',
    )
    const img3 = await sc.uploadFile(
      alice,
      '../dev-env/src/seed/img/key-landscape-small.jpg',
      'image/jpeg',
    )

    await sc.post(alice, 'test', undefined, [img1])
    await sc.post(alice, 'test', undefined, [img1, img2])
    await sc.post(alice, 'test', undefined, [img3])

    await network.processAll()

    await oldAgent.login({
      identifier: sc.accounts[alice].handle,
      password: sc.accounts[alice].password,
    })
  })

  afterAll(async () => {
    await newPds.close()
    await network.close()
  })

  it('works', async () => {
    const describeRes = await newAgent.api.com.atproto.server.describeServer()
    const newServerDid = describeRes.data.did

    const serviceJwtRes = await oldAgent.com.atproto.server.getServiceAuth({
      aud: newServerDid,
    })
    const serviceJwt = serviceJwtRes.data.token

    await newAgent.api.com.atproto.server.createAccount(
      {
        handle: 'new-alice.test',
        email: 'alice@test.com',
        password: 'alice-pass',
        did: alice,
      },
      {
        headers: { authorization: `Bearer ${serviceJwt}` },
        encoding: 'application/json',
      },
    )
    await newAgent.login({
      identifier: 'new-alice.test',
      password: 'alice-pass',
    })

    const repoRes = await oldAgent.com.atproto.sync.getRepo({ did: alice })

    await newAgent.com.atproto.repo.importRepo(repoRes.data, {
      encoding: 'application/vnd.ipld.car',
    })

    const statusRes = await newAgent.com.atproto.server.checkAccountStatus()
    expect(statusRes.data.indexedRecords).toBe(103)
    expect(statusRes.data.expectedBlobs).toBe(3)
    expect(statusRes.data.importedBlobs).toBe(0)

    let blobCursor: string | undefined = undefined
    do {
      const listedBlobs = await oldAgent.com.atproto.sync.listBlobs({
        did: alice,
        cursor: blobCursor,
      })
      for (const cid of listedBlobs.data.cids) {
        const blobRes = await oldAgent.com.atproto.sync.getBlob({
          did: alice,
          cid,
        })
        await newAgent.com.atproto.repo.uploadBlob(blobRes.data, {
          encoding: blobRes.headers['content-type'],
        })
      }
      blobCursor = listedBlobs.data.cursor
    } while (blobCursor)

    const statusRes2 = await newAgent.com.atproto.server.checkAccountStatus()
    expect(statusRes2.data.expectedBlobs).toBe(3)
    expect(statusRes2.data.importedBlobs).toBe(3)

    const prefs = await oldAgent.api.app.bsky.actor.getPreferences()
    await newAgent.api.app.bsky.actor.putPreferences(prefs.data)

    const getDidCredentials =
      await newAgent.com.atproto.identity.getRecommendedDidCredentials()

    const plcOp = await oldAgent.com.atproto.identity.signPlcOperation(
      getDidCredentials.data,
    )

    await newAgent.com.atproto.identity.submitPlcOperation({
      operation: plcOp.data.operation,
    })

    await newAgent.com.atproto.server.activateAccount()
    await oldAgent.com.atproto.server.deactivateAccount({
      deleteAfter: new Date(Date.now() + HOUR).toISOString(),
    })
  })
})
