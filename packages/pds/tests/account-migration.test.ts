import {
  type MockInstance,
  afterAll,
  assert,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { AtUri, type AtpAgent } from '@atproto/api'
import {
  type Account,
  type SeedClient,
  TestNetworkNoAppView,
  TestPds,
  assetPath,
  mockNetworkUtilities,
} from '@atproto/dev-env'
import { readCar } from '@atproto/repo'
import type { AppContext } from '../src/index.js'

describe('account migration', () => {
  let network: TestNetworkNoAppView
  let newPds: TestPds
  let completePds: TestPds

  let sc: SeedClient
  let oldAgent: AtpAgent
  let newAgent: AtpAgent

  let alice: Account
  let sendMailMock: MockInstance<
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
    completePds = await TestPds.create({
      didPlcUrl: network.plc.url,
      spacesMigration: 'complete',
    })
    mockNetworkUtilities(completePds)

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
      assetPath('at.png'),
      'image/png',
    )
    const img2 = await sc.uploadFile(
      alice.did,
      assetPath('key-alt.jpg'),
      'image/jpeg',
    )
    const img3 = await sc.uploadFile(
      alice.did,
      assetPath('key-landscape-small.jpg'),
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

    sendMailMock = vi
      .spyOn(network.pds.ctx.mailer.transporter, 'sendMail')
      .mockImplementation(async () => {})
  })

  beforeEach(() => {
    // Catch-all: never actually send, but keep recording calls for assertions.
    sendMailMock.mockClear()
  })

  afterAll(async () => {
    await completePds?.close()
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

    // The brought DID doesn't name the new kem key yet: left for the publisher
    const progress = await newPds.ctx.accountManager.db.db
      .selectFrom('spaces_migration')
      .selectAll()
      .where('did', '=', alice.did)
      .executeTakeFirst()
    expect(progress).toMatchObject({
      kemPublishedAt: null,
      storeMigratedAt: expect.any(String),
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

    using sendPlcOperationMock = vi.spyOn(
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

  // Creates the account on the target and points its DID document there
  // without its KEM key, as a client submitting the op straight to PLC could
  const migrateWithoutKemKey = async (name: string, target: TestPds) => {
    await sc.createAccount(name, {
      email: `${name}@test.com`,
      handle: `${name}.test`,
      password: `${name}-pass`,
    })
    const account = sc.accounts[sc.dids[name]]
    const oldAccountAgent = network.pds.getAgent()
    await oldAccountAgent.login({
      identifier: account.handle,
      password: account.password,
    })

    const targetAgent = target.getAgent()
    const describeRes = await targetAgent.com.atproto.server.describeServer()
    const serviceJwtRes =
      await oldAccountAgent.com.atproto.server.getServiceAuth({
        aud: describeRes.data.did,
        lxm: 'com.atproto.server.createAccount',
      })
    await targetAgent.com.atproto.server.createAccount(
      {
        handle: `new-${name}.test`,
        email: account.email,
        password: account.password,
        did: account.did,
      },
      {
        headers: { authorization: `Bearer ${serviceJwtRes.data.token}` },
        encoding: 'application/json',
      },
    )
    await targetAgent.login({
      identifier: `new-${name}.test`,
      password: account.password,
    })

    const signingKey = await target.ctx.actorStore.keypair(account.did)
    const kemKey = await target.ctx.actorStore.kemKeypair(account.did)
    assert(kemKey)
    await network.pds.ctx.plcClient.updateData(
      account.did,
      network.pds.ctx.plcRotationKey,
      (op) => ({
        ...op,
        rotationKeys: [target.ctx.plcRotationKey.did()],
        services: {
          atproto_pds: {
            type: 'AtprotoPersonalDataServer',
            endpoint: target.ctx.cfg.service.publicUrl,
          },
        },
        verificationMethods: { atproto: signingKey.did() },
      }),
    )
    return { did: account.did, kemKey, agent: targetAgent }
  }

  it('activates an account without its KEM key until the spaces migration is complete', async () => {
    const { agent } = await migrateWithoutKemKey('carol', newPds)

    // The publisher publishes it once the account is active
    await agent.com.atproto.server.activateAccount()
    const statusRes = await agent.com.atproto.server.checkAccountStatus()
    expect(statusRes.data).toMatchObject({ activated: true, validDid: true })
  })

  it('does not activate an account until its DID document has its KEM key', async () => {
    const { did, kemKey, agent } = await migrateWithoutKemKey(
      'bob',
      completePds,
    )

    await expect(agent.com.atproto.server.activateAccount()).rejects.toThrow(
      'does not match expected KEM key',
    )
    const statusRes1 = await agent.com.atproto.server.checkAccountStatus()
    expect(statusRes1.data).toMatchObject({ activated: false, validDid: false })

    await completePds.ctx.plcClient.updateData(
      did,
      completePds.ctx.plcRotationKey,
      (op) => ({
        ...op,
        verificationMethods: {
          ...op.verificationMethods,
          atproto_kem: kemKey.did(),
        },
      }),
    )

    await agent.com.atproto.server.activateAccount()
    const statusRes2 = await agent.com.atproto.server.checkAccountStatus()
    expect(statusRes2.data).toMatchObject({ activated: true, validDid: true })
  })
})
