import assert from 'node:assert'
import * as os from 'node:os'
import * as path from 'node:path'
import AtpAgent from '@atproto/api'
import { Secp256k1Keypair, randomStr } from '@atproto/crypto'
import { SeedClient, TestPds, TestPlc, mockResolvers } from '@atproto/dev-env'
import * as pdsEntryway from '@atproto/pds-entryway'
import * as ui8 from 'uint8arrays'

describe('entryway', () => {
  let plc: TestPlc
  let pds: TestPds
  let entryway: pdsEntryway.PDS
  let pdsAgent: AtpAgent
  let entrywayAgent: AtpAgent

  beforeAll(async () => {
    const jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    plc = await TestPlc.create({})
    pds = await TestPds.create({
      port: plc.port + 1,
      entrywayUrl: `http://localhost:${plc.port + 2}`,
      entrywayJwtVerifyKeyK256PublicKeyHex: getPublicHex(jwtSigningKey),
      entrywayPlcRotationKeyK256PublicKeyHex: getPublicHex(plcRotationKey),
      adminPassword: 'admin-pass',
      serviceHandleDomains: [],
      didPlcUrl: plc.url,
      serviceDid: 'did:example:pds',
      inviteRequired: false,
    })
    entryway = await createEntryway({
      dbPostgresSchema: 'entryway',
      port: plc.port + 2,
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
  })

  afterAll(async () => {
    await plc.close()
    await entryway.destroy()
    await pds.close()
  })

  it('creates account.', async () => {
    const {
      data: { did },
    } = await entrywayAgent.api.com.atproto.server.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'test123',
    })
    await moveAccountToPds(did, pds, { entryway, plc })
    const {
      data: { accessJwt },
    } = await entrywayAgent.api.com.atproto.server.createSession({
      identifier: 'alice.test',
      password: 'test123',
    })
    // can get session on either service
    const entrywaySession =
      await entrywayAgent.api.com.atproto.server.getSession(undefined, {
        headers: SeedClient.getHeaders(accessJwt),
      })
    const pdsSession = await pdsAgent.api.com.atproto.server.getSession(
      undefined,
      { headers: SeedClient.getHeaders(accessJwt) },
    )
    expect(entrywaySession).toEqual(pdsSession)
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

// @TODO temporary helper while createAccount flow isn't complete w/ reserveSigningKey
const moveAccountToPds = async (
  did: string,
  pds: TestPds,
  services: { entryway: pdsEntryway.PDS; plc: TestPlc },
) => {
  const { entryway, plc } = services
  const account = await entryway.ctx.services
    .account(entryway.ctx.db)
    .getAccount(did)
  assert(account)
  const signingKey = await Secp256k1Keypair.create({ exportable: true })
  const commit = await pds.ctx.actorStore.create(
    did,
    signingKey,
    (actorTxn) => {
      return actorTxn.repo.createRepo([])
    },
  )
  await pds.ctx.accountManager.createAccount({
    did,
    email: `${did}@email.invalid`,
    handle: account.handle,
    password: randomStr(8, 'base32'),
    repoCid: commit.cid,
    repoRev: commit.rev,
    inviteCode: undefined,
  })
  const plcClient = plc.getClient()
  await plcClient.updatePds(
    did,
    entryway.ctx.plcRotationKey,
    pds.ctx.cfg.service.publicUrl,
  )
  await plcClient.updateAtprotoKey(
    did,
    entryway.ctx.plcRotationKey,
    signingKey.did(),
  )
  await entryway.ctx.services.repo(entryway.ctx.db).deleteRepo(did)
  await entryway.ctx.db.db
    .updateTable('user_account')
    .set({ pdsId: entryway.ctx.db.db.selectFrom('pds').select('id').limit(1) })
    .where('did', '=', did)
    .execute()
}

const getPublicHex = (key: Secp256k1Keypair) => {
  return key.publicKeyStr('hex')
}

const getPrivateHex = async (key: Secp256k1Keypair) => {
  return ui8.toString(await key.export(), 'hex')
}
