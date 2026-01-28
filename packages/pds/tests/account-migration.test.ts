import assert from 'node:assert'
import {
  SeedClient,
  TestNetworkNoAppView,
  TestPds,
  mockNetworkUtilities,
} from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { PasswordSession } from '@atproto/lex-password-session'
import { readCar } from '@atproto/repo'
import { AtUri, DidString } from '@atproto/syntax'
import { app, com } from '../src/lexicons'

describe('account migration', () => {
  let network: TestNetworkNoAppView
  let newPds: TestPds

  let sc: SeedClient
  let oldClient: Client
  let newClient: Client

  let alice: DidString

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'account_migration',
    })
    newPds = await TestPds.create({
      didPlcUrl: network.plc.url,
    })
    mockNetworkUtilities(newPds)

    sc = network.getSeedClient()

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
      '../dev-env/assets/at.png',
      'image/png',
    )
    const img2 = await sc.uploadFile(
      alice,
      '../dev-env/assets/key-alt.jpg',
      'image/jpeg',
    )
    const img3 = await sc.uploadFile(
      alice,
      '../dev-env/assets/key-landscape-small.jpg',
      'image/jpeg',
    )

    await sc.post(alice, 'test', undefined, [img1])
    await sc.post(alice, 'test', undefined, [img1, img2])
    await sc.post(alice, 'test', undefined, [img3])

    await network.processAll()

    const oldSession = await PasswordSession.login({
      service: network.pds.url,
      identifier: sc.accounts[alice].handle,
      password: sc.accounts[alice].password,
    })

    oldClient = new Client(oldSession)

    const describeRes = await newClient.call(com.atproto.server.describeServer)

    const { token } = await oldClient.call(com.atproto.server.getServiceAuth, {
      aud: describeRes.did,
      lxm: 'com.atproto.server.createAccount',
    })

    const newSession = await PasswordSession.createAccount(
      {
        handle: 'new-alice.test',
        email: 'alice@test.com',
        password: 'alice-pass',
        did: alice,
      },
      {
        service: newPds.url,
        headers: { authorization: `Bearer ${token}` },
      },
    )

    newClient = new Client(newSession)
  })

  afterAll(async () => {
    await newPds.close()
    await network.close()
  })

  it('migrates an account', async () => {
    expect(
      await newClient.call(com.atproto.server.checkAccountStatus),
    ).toMatchObject({
      activated: false,
      validDid: false,
      repoBlocks: 2, // commit & empty data root
      indexedRecords: 0,
      privateStateValues: 0,
      expectedBlobs: 0,
      importedBlobs: 0,
    })

    const repoRes = await oldClient.call(com.atproto.sync.getRepo, {
      did: alice,
    })
    const carBlocks = await readCar(repoRes)

    await newClient.call(com.atproto.repo.importRepo, repoRes, {
      headers: { 'content-type': 'application/vnd.ipld.car' },
    })

    const statusRes2 = await newClient.call(
      com.atproto.server.checkAccountStatus,
    )
    expect(statusRes2).toMatchObject({
      activated: false,
      validDid: false,
      indexedRecords: 103,
      privateStateValues: 0,
      expectedBlobs: 3,
      importedBlobs: 0,
    })
    expect(statusRes2.repoBlocks).toBe(carBlocks.blocks.size)

    const missingBlobs = await newClient.call(com.atproto.repo.listMissingBlobs)
    expect(missingBlobs.blobs.length).toBe(3)

    let blobCursor: string | undefined = undefined
    do {
      const listedBlobs = await oldClient.call(com.atproto.sync.listBlobs, {
        did: alice,
        cursor: blobCursor,
      })
      for (const cid of listedBlobs.cids) {
        const blobRes = await oldClient.xrpc(com.atproto.sync.getBlob, {
          params: { did: alice, cid },
        })
        await newClient.uploadBlob(blobRes.body, {
          encoding: blobRes.headers['content-type'],
        })
      }
      blobCursor = listedBlobs.cursor
    } while (blobCursor)

    expect(
      await newClient.call(com.atproto.server.checkAccountStatus),
    ).toMatchObject({
      expectedBlobs: 3,
      importedBlobs: 3,
    })

    const prefs = await oldClient.call(app.bsky.actor.getPreferences)
    await newClient.call(app.bsky.actor.putPreferences, prefs)

    const getDidCredentials = await newClient.call(
      com.atproto.identity.getRecommendedDidCredentials,
    )

    await oldClient.call(com.atproto.identity.requestPlcOperationSignature)
    const res = await network.pds.ctx.accountManager.db.db
      .selectFrom('email_token')
      .selectAll()
      .where('did', '=', alice)
      .where('purpose', '=', 'plc_operation')
      .executeTakeFirst()
    const token = res?.token
    assert(token)

    const plcOp = await oldClient.call(com.atproto.identity.signPlcOperation, {
      token,
      ...getDidCredentials,
    })

    await newClient.call(com.atproto.identity.submitPlcOperation, {
      operation: plcOp.operation,
    })

    await newClient.call(com.atproto.server.activateAccount)

    expect(
      await newClient.call(com.atproto.server.checkAccountStatus),
    ).toMatchObject({
      activated: true,
      validDid: true,
      indexedRecords: 103,
      privateStateValues: 0,
      expectedBlobs: 3,
      importedBlobs: 3,
    })

    await oldClient.call(com.atproto.server.deactivateAccount, {})

    const statusResOldPds = await oldClient.call(
      com.atproto.server.checkAccountStatus,
    )
    expect(statusResOldPds).toMatchObject({
      activated: false,
      validDid: false,
    })

    const postRes = await newClient.create(app.bsky.feed.post, {
      text: 'new pds!',
      createdAt: new Date().toISOString(),
    })
    const postUri = new AtUri(postRes.uri)
    const fetchedPost = await newClient.get(app.bsky.feed.post, {
      repo: postUri.did,
      rkey: postUri.rkey,
    })
    expect(fetchedPost.value.text).toEqual('new pds!')
    const statusRes5 = await newClient.call(
      com.atproto.server.checkAccountStatus,
    )
    expect(statusRes5.indexedRecords).toBe(104)
  })
})
