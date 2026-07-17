import { jest } from '@jest/globals'
import { AtUri, type AtpAgent } from '@atproto/api'
import {
  type Account,
  type SeedClient,
  TestNetworkNoAppView,
  TestPds,
  mockNetworkUtilities,
} from '@atproto/dev-env'
import { readCar } from '@atproto/repo'
import type { AppContext } from '../src/index.js'

describe('account migration', () => {
  let network: TestNetworkNoAppView
  let newPds: TestPds

  let sc: SeedClient
  let oldAgent: AtpAgent
  let newAgent: AtpAgent

  let alice: Account
  let sendMailMock: jest.SpiedFunction<
    AppContext['mailer']['transporter']['sendMail']
  >

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_migration',
    })
    newPds = await TestPds.create({
      didPlcUrl: network.plc.url,
    })
    mockNetworkUtilities(newPds)

    sc = network.getSeedClient()
    oldAgent = network.pds.getAgent()
    newAgent = newPds.getAgent()

    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    alice = sc.accounts[sc.dids.alice]

    for (let i = 0; i < 100; i++) {
      await sc.post(alice.did, 'test post')
    }
    const img1 = await sc.uploadFile(
      alice.did,
      '../dev-env/assets/at.png',
      'image/png',
    )
    const img2 = await sc.uploadFile(
      alice.did,
      '../dev-env/assets/key-alt.jpg',
      'image/jpeg',
    )
    const img3 = await sc.uploadFile(
      alice.did,
      '../dev-env/assets/key-landscape-small.jpg',
      'image/jpeg',
    )

    await sc.post(alice.did, 'test', undefined, [img1])
    await sc.post(alice.did, 'test', undefined, [img1, img2])
    await sc.post(alice.did, 'test', undefined, [img3])

    await network.processAll()

    await oldAgent.login({
      identifier: alice.handle,
      password: alice.password,
    })

    sendMailMock = jest
      .spyOn(network.pds.ctx.mailer.transporter, 'sendMail')
      .mockImplementation(async () => {})
  })

  beforeEach(() => {
    // Catch-all: never actually send, but keep recording calls for assertions.
    sendMailMock.mockClear()
  })

  afterAll(async () => {
    await newPds?.close()
    await network?.close()
  })

  it('migrates an account', async () => {
    const describeRes = await newAgent.api.com.atproto.server.describeServer()
    const newServerDid = describeRes.data.did

    const serviceJwtRes = await oldAgent.com.atproto.server.getServiceAuth({
      aud: newServerDid,
      lxm: 'com.atproto.server.createAccount',
    })
    const serviceJwt = serviceJwtRes.data.token

    await newAgent.api.com.atproto.server.createAccount(
      {
        handle: 'new-alice.test',
        email: 'alice@test.com',
        password: 'alice-pass',
        did: alice.did,
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

    const statusRes1 = await newAgent.com.atproto.server.checkAccountStatus()
    expect(statusRes1.data).toMatchObject({
      activated: false,
      validDid: false,
      repoBlocks: 2, // commit & empty data root
      indexedRecords: 0,
      privateStateValues: 0,
      expectedBlobs: 0,
      importedBlobs: 0,
    })

    const repoRes = await oldAgent.com.atproto.sync.getRepo({ did: alice.did })
    const carBlocks = await readCar(repoRes.data)

    await newAgent.com.atproto.repo.importRepo(repoRes.data, {
      encoding: 'application/vnd.ipld.car',
    })

    const statusRes2 = await newAgent.com.atproto.server.checkAccountStatus()
    expect(statusRes2.data).toMatchObject({
      activated: false,
      validDid: false,
      indexedRecords: 103,
      privateStateValues: 0,
      expectedBlobs: 3,
      importedBlobs: 0,
    })
    expect(statusRes2.data.repoBlocks).toBe(carBlocks.blocks.size)

    const missingBlobs = await newAgent.com.atproto.repo.listMissingBlobs()
    expect(missingBlobs.data.blobs.length).toBe(3)

    let blobCursor: string | undefined = undefined
    do {
      const listedBlobs = await oldAgent.com.atproto.sync.listBlobs({
        did: alice.did,
        cursor: blobCursor,
      })
      for (const cid of listedBlobs.data.cids) {
        const blobRes = await oldAgent.com.atproto.sync.getBlob({
          did: alice.did,
          cid,
        })
        await newAgent.com.atproto.repo.uploadBlob(blobRes.data, {
          encoding: blobRes.headers['content-type'],
        })
      }
      blobCursor = listedBlobs.data.cursor
    } while (blobCursor)

    const statusRes3 = await newAgent.com.atproto.server.checkAccountStatus()
    expect(statusRes3.data.expectedBlobs).toBe(3)
    expect(statusRes3.data.importedBlobs).toBe(3)

    const prefs = await oldAgent.api.app.bsky.actor.getPreferences()
    await newAgent.api.app.bsky.actor.putPreferences(prefs.data)

    const getDidCredentials =
      await newAgent.com.atproto.identity.getRecommendedDidCredentials()

    using sendPlcOperationMock = jest.spyOn(
      network.pds.ctx.mailer,
      'sendPlcOperation',
    )

    await oldAgent.com.atproto.identity.requestPlcOperationSignature()

    expect(sendPlcOperationMock).toHaveBeenCalledTimes(1)
    const [params] = sendPlcOperationMock.mock.lastCall!
    expect(params).toEqual({
      token: expect.any(String),
    })

    const [mail] = sendMailMock.mock.lastCall!
    expect(mail.to).toBe(alice.email)
    expect(mail.subject).toEqual('PLC Update Operation Requested')
    expect(mail.html).toContain('We received a request to update your PLC')

    const plcOp = await oldAgent.com.atproto.identity.signPlcOperation({
      token: params.token,
      ...getDidCredentials.data,
    })

    await newAgent.com.atproto.identity.submitPlcOperation({
      operation: plcOp.data.operation,
    })

    await newAgent.com.atproto.server.activateAccount()

    const statusRes4 = await newAgent.com.atproto.server.checkAccountStatus()
    expect(statusRes4.data).toMatchObject({
      activated: true,
      validDid: true,
      indexedRecords: 103,
      privateStateValues: 0,
      expectedBlobs: 3,
      importedBlobs: 3,
    })

    await oldAgent.com.atproto.server.deactivateAccount({})

    const statusResOldPds =
      await oldAgent.com.atproto.server.checkAccountStatus()
    expect(statusResOldPds.data).toMatchObject({
      activated: false,
      validDid: false,
    })

    const postRes = await newAgent.api.app.bsky.feed.post.create(
      { repo: alice.did },
      {
        text: 'new pds!',
        createdAt: new Date().toISOString(),
      },
    )
    const postUri = new AtUri(postRes.uri)
    const fetchedPost = await newAgent.api.app.bsky.feed.post.get({
      repo: postUri.hostname,
      rkey: postUri.rkey,
    })
    expect(fetchedPost.value.text).toEqual('new pds!')
    const statusRes5 = await newAgent.com.atproto.server.checkAccountStatus()
    expect(statusRes5.data.indexedRecords).toBe(104)
  })
})
