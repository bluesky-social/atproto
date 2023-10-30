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
    for (let i = 0; i < 50; i++) {
      const post = await sc.post(did, 'blah')
      await sc.like(did, post.ref)
    }
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
    const transferRes =
      await transferAgent.api.com.atproto.temp.transferAccount({
        did,
        handle: account.handle,
        plcOp: cborEncode(plcOp),
      })
    transferAgent.api.setHeader(
      'authorization',
      `Bearer ${transferRes.data.accessJwt}`,
    )

    const repo = await origAgent.api.com.atproto.sync.getRepo({ did })
    const res = await axios.post(
      `${transferPds.url}/xrpc/com.atproto.temp.importRepo`,
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

    // await transferAgent.login({
    //   identifier: account.handle,
    //   password: account.password,
    // })

    await transferAgent.api.app.bsky.feed.post.create(
      { repo: did },
      {
        text: 'asdflsidkfu',
        createdAt: new Date().toISOString(),
      },
    )

    const listPosts = await transferAgent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: 'app.bsky.feed.post',
      limit: 100,
    })
    const listLikes = await transferAgent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: 'app.bsky.feed.like',
      limit: 100,
    })

    expect(listPosts.data.records.length).toBe(52)
    expect(listLikes.data.records.length).toBe(50)
  })
})
