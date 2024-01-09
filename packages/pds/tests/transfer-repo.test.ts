import path from 'node:path'
import os from 'node:os'
import axios from 'axios'
import * as ui8 from 'uint8arrays'
import { SeedClient, TestPds, TestPlc, mockResolvers } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import * as pdsEntryway from '@atproto/pds-entryway'
import { Secp256k1Keypair, randomStr } from '@atproto/crypto'
import * as plcLib from '@did-plc/lib'
import getPort from 'get-port'

describe('transfer repo', () => {
  let plc: TestPlc
  let pds: TestPds
  let entryway: pdsEntryway.PDS
  let entrywaySc: SeedClient
  let pdsAgent: AtpAgent
  let entrywayAgent: AtpAgent

  let did: string
  const accountDetail = {
    email: 'alice@test.com',
    handle: 'alice.test',
    password: 'test123',
  }

  beforeAll(async () => {
    const jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const entrywayPort = await getPort()
    plc = await TestPlc.create({})
    pds = await TestPds.create({
      entrywayUrl: `http://localhost:${entrywayPort}`,
      entrywayDid: 'did:example:entryway',
      entrywayJwtVerifyKeyK256PublicKeyHex: getPublicHex(jwtSigningKey),
      entrywayPlcRotationKey: plcRotationKey.did(),
      adminPassword: 'admin-pass',
      serviceHandleDomains: [],
      didPlcUrl: plc.url,
      serviceDid: 'did:example:pds',
      inviteRequired: false,
    })
    entryway = await createEntryway({
      dbPostgresSchema: 'transfer_repo',
      port: entrywayPort,
      adminPassword: 'admin-pass',
      jwtSigningKeyK256PrivateKeyHex: await getPrivateHex(jwtSigningKey),
      plcRotationKeyK256PrivateKeyHex: await getPrivateHex(plcRotationKey),
      inviteRequired: false,
      serviceDid: 'did:example:entryway',
      didPlcUrl: plc.url,
    })
    mockResolvers(pds.ctx.idResolver, pds)
    mockResolvers(entryway.ctx.idResolver, pds)
    await entryway.ctx.db.db
      .insertInto('pds')
      .values({
        did: pds.ctx.cfg.service.did,
        host: new URL(pds.ctx.cfg.service.publicUrl).host,
        weight: 0,
      })
      .execute()
    pdsAgent = pds.getClient()
    entrywayAgent = new AtpAgent({
      service: entryway.ctx.cfg.service.publicUrl,
    })

    // @ts-ignore network not needed
    entrywaySc = new SeedClient({}, entrywayAgent)
    await entrywaySc.createAccount('alice', accountDetail)
    did = entrywaySc.dids.alice
    for (let i = 0; i < 50; i++) {
      const post = await entrywaySc.post(did, 'blah')
      await entrywaySc.like(did, post.ref)
    }
    const img = await entrywaySc.uploadFile(
      did,
      '../dev-env/src/seed/img/key-landscape-small.jpg',
      'image/jpeg',
    )
    await entrywaySc.post(did, 'img post', undefined, [img])
  })

  afterAll(async () => {
    await plc.close()
    await entryway.destroy()
    await pds.close()
  })

  it('transfers', async () => {
    const signingKeyRes =
      await pdsAgent.api.com.atproto.server.reserveSigningKey({ did })
    const signingKey = signingKeyRes.data.signingKey

    const repo = await entrywayAgent.api.com.atproto.sync.getRepo({ did })
    const importRes = await axios.post(
      `${pds.url}/xrpc/com.atproto.temp.importRepo`,
      repo.data,
      {
        params: { did },
        headers: {
          'content-type': 'application/vnd.ipld.car',
          ...pds.adminAuthHeaders('admin'),
        },
        decompress: true,
        responseType: 'stream',
      },
    )

    for await (const _log of importRes.data) {
      // noop just wait till import is finished
    }

    const lastOp = await pds.ctx.plcClient.getLastOp(did)
    if (!lastOp || lastOp.type === 'plc_tombstone') {
      throw new Error('could not find last plc op')
    }
    const plcOp = await plcLib.createUpdateOp(
      lastOp,
      entryway.ctx.plcRotationKey,
      (normalized) => ({
        ...normalized,
        rotationKeys: [pds.ctx.plcRotationKey.did()],
        verificationMethods: {
          atproto: signingKey,
        },
        services: {
          atproto_pds: {
            type: 'AtprotoPersonalDataServer',
            endpoint: pds.ctx.cfg.service.publicUrl,
          },
        },
      }),
    )
    await pdsAgent.api.com.atproto.temp.transferAccount(
      {
        did,
        handle: accountDetail.handle,
        plcOp,
      },
      { headers: pds.adminAuthHeaders('admin'), encoding: 'application/json' },
    )

    await entryway.ctx.db.db
      .updateTable('user_account')
      .set({
        pdsId: entryway.ctx.db.db.selectFrom('pds').select('id').limit(1),
      })
      .where('did', '=', did)
      .execute()

    await pdsAgent.login({
      identifier: accountDetail.handle,
      password: accountDetail.password,
    })

    await pdsAgent.api.app.bsky.feed.post.create(
      { repo: did },
      {
        text: 'asdflsidkfu',
        createdAt: new Date().toISOString(),
      },
    )

    const listPosts = await pdsAgent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: 'app.bsky.feed.post',
      limit: 100,
    })
    const listLikes = await pdsAgent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: 'app.bsky.feed.like',
      limit: 100,
    })

    expect(listPosts.data.records.length).toBe(52)
    expect(listLikes.data.records.length).toBe(50)
  })
})

const createEntryway = async (
  config: pdsEntryway.ServerEnvironment & {
    adminPassword: string
    jwtSigningKeyK256PrivateKeyHex: string
    plcRotationKeyK256PrivateKeyHex: string
  },
) => {
  const signingKey = await Secp256k1Keypair.create({ exportable: true })
  const recoveryKey = await Secp256k1Keypair.create({ exportable: true })
  const env: pdsEntryway.ServerEnvironment = {
    isEntryway: true,
    recoveryDidKey: recoveryKey.did(),
    serviceHandleDomains: ['.test'],
    dbPostgresUrl: process.env.DB_POSTGRES_URL,
    blobstoreDiskLocation: path.join(os.tmpdir(), randomStr(8, 'base32')),
    bskyAppViewUrl: 'https://appview.invalid',
    bskyAppViewDid: 'did:example:invalid',
    bskyAppViewCdnUrlPattern: 'http://cdn.appview.com/%s/%s/%s',
    jwtSecret: randomStr(8, 'base32'),
    repoSigningKeyK256PrivateKeyHex: await getPrivateHex(signingKey),
    ...config,
  }
  const cfg = pdsEntryway.envToCfg(env)
  const secrets = pdsEntryway.envToSecrets(env)
  const server = await pdsEntryway.PDS.create(cfg, secrets)
  await server.ctx.db.migrateToLatestOrThrow()
  await server.start()
  return server
}

const getPublicHex = (key: Secp256k1Keypair) => {
  return key.publicKeyStr('hex')
}

const getPrivateHex = async (key: Secp256k1Keypair) => {
  return ui8.toString(await key.export(), 'hex')
}
