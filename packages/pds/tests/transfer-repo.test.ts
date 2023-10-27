import axios from 'axios'
import { TestNetworkNoAppView, SeedClient, TestPds } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import * as plc from '@did-plc/lib'
import { cborEncode } from '@atproto/common'

describe('transfer repo', () => {
  let network: TestNetworkNoAppView
  let transferPds: TestPds
  let origAgent: AtpAgent
  let transferAgent: AtpAgent
  let sc: SeedClient
  let did: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'transer_repo',
    })
    transferPds = await TestPds.create({
      didPlcUrl: network.plc.url,
    })
    origAgent = network.pds.getClient()
    transferAgent = transferPds.getClient()
    sc = network.getSeedClient()
    await sc.createAccount('alice', {
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    did = sc.dids.alice
    await sc.post(did, 'blah')
    const img = await sc.uploadFile(
      did,
      'tests/sample-img/key-landscape-small.jpg',
      'image/jpeg',
    )
    await sc.post(did, 'img post', undefined, [img])
  })

  afterAll(async () => {
    await transferPds.close()
    await network.close()
  })

  it('transfers', async () => {
    const account = sc.accounts[did]
    const passRes = await network.pds.ctx.accountManager.db.db
      .selectFrom('account')
      .select('passwordScrypt')
      .where('did', '=', did)
      .executeTakeFirst()
    const signingKeyRes =
      await transferAgent.api.com.atproto.server.reserveSigningKey()
    const signingKey = signingKeyRes.data.signingKey
    const lastOp = await network.pds.ctx.plcClient.getLastOp(did)
    if (!lastOp || lastOp.type === 'plc_tombstone') {
      throw new Error('could not find last plc op')
    }
    const plcOp = await plc.createUpdateOp(
      lastOp,
      network.pds.ctx.plcRotationKey,
      (normalized) => ({
        ...normalized,
        rotationKeys: [transferPds.ctx.plcRotationKey.did()],
        verificationMethods: {
          atproto: signingKey,
        },
        services: {
          atproto_pds: {
            type: 'AtprotoPersonalDataServer',
            endpoint: transferPds.ctx.cfg.service.publicUrl,
          },
        },
      }),
    )
    await transferAgent.api.com.atproto.temp.transferAccount({
      did,
      handle: account.handle,
      email: account.email,
      passwordScrypt: passRes?.passwordScrypt ?? '',
      plcOp: cborEncode(plcOp),
    })

    const repo = await origAgent.api.com.atproto.sync.getRepo({ did })
    const res = await axios.post(
      `${transferPds.url}/xrpc/com.atproto.sync.importRepo`,
      repo.data,
      {
        params: { did },
        headers: { 'content-type': 'application/vnd.ipld.car' },
        decompress: true,
        responseType: 'stream',
      },
    )
    for await (const log of res.data) {
      console.log(log.toString())
    }

    await transferAgent.login({
      identifier: account.handle,
      password: account.password,
    })

    await transferAgent.api.app.bsky.feed.post.create(
      { repo: did },
      {
        text: 'asdflsidkfu',
        createdAt: new Date().toISOString(),
      },
    )

    const listRecords = await transferAgent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: 'app.bsky.feed.post',
    })
    expect(listRecords.data.records.length).toBe(3)
  })
})
