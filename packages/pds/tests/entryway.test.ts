import assert from 'node:assert'
import * as os from 'node:os'
import * as path from 'node:path'
import * as plcLib from '@did-plc/lib'
import getPort from 'get-port'
import { decodeJwt } from 'jose'
import * as ui8 from 'uint8arrays'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair, randomStr } from '@atproto/crypto'
import { SeedClient, TestPds, TestPlc, mockResolvers } from '@atproto/dev-env'
import * as pdsEntryway from '@atproto/pds-entryway'
import { parseReqNsid } from '@atproto/xrpc-server'

describe('entryway', () => {
  let plc: TestPlc
  let pds: TestPds
  let entryway: pdsEntryway.PDS
  let pdsAgent: AtpAgent
  let entrywayAgent: AtpAgent
  let alice: string
  let accessToken: string

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
      dbPostgresSchema: 'entryway',
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
        weight: 1,
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
    const res = await entrywayAgent.api.com.atproto.server.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'test123',
    })
    alice = res.data.did
    accessToken = res.data.accessJwt

    const account = await pds.ctx.accountManager.getAccount(alice)
    expect(account?.did).toEqual(alice)
    expect(account?.handle).toEqual('alice.test')
  })

  it('auths with both services.', async () => {
    const entrywaySession =
      await entrywayAgent.api.com.atproto.server.getSession(undefined, {
        headers: SeedClient.getHeaders(accessToken),
      })
    const pdsSession = await pdsAgent.api.com.atproto.server.getSession(
      undefined,
      { headers: SeedClient.getHeaders(accessToken) },
    )
    expect(entrywaySession.data).toEqual(pdsSession.data)
  })

  it('updates handle from pds.', async () => {
    await pdsAgent.api.com.atproto.identity.updateHandle(
      { handle: 'alice2.test' },
      {
        headers: SeedClient.getHeaders(accessToken),
        encoding: 'application/json',
      },
    )
    const doc = await pds.ctx.idResolver.did.resolve(alice)
    const handleToDid = await pds.ctx.idResolver.handle.resolve('alice2.test')
    const accountFromPds = await pds.ctx.accountManager.getAccount(alice)
    const accountFromEntryway = await entryway.ctx.services
      .account(entryway.ctx.db)
      .getAccount(alice)
    expect(doc?.alsoKnownAs).toEqual(['at://alice2.test'])
    expect(handleToDid).toEqual(alice)
    expect(accountFromPds?.handle).toEqual('alice2.test')
    expect(accountFromEntryway?.handle).toEqual('alice2.test')
  })

  it('updates handle from entryway.', async () => {
    await entrywayAgent.api.com.atproto.identity.updateHandle(
      { handle: 'alice3.test' },
      await pds.ctx.serviceAuthHeaders(
        alice,
        'did:example:entryway',
        'com.atproto.identity.updateHandle',
      ),
    )
    const doc = await entryway.ctx.idResolver.did.resolve(alice)
    const handleToDid =
      await entryway.ctx.idResolver.handle.resolve('alice3.test')
    const accountFromPds = await pds.ctx.accountManager.getAccount(alice)
    const accountFromEntryway = await entryway.ctx.services
      .account(entryway.ctx.db)
      .getAccount(alice)
    expect(doc?.alsoKnownAs).toEqual(['at://alice3.test'])
    expect(handleToDid).toEqual(alice)
    expect(accountFromPds?.handle).toEqual('alice3.test')
    expect(accountFromEntryway?.handle).toEqual('alice3.test')
  })

  it('does not allow bringing own op to account creation.', async () => {
    const {
      data: { signingKey },
    } = await pdsAgent.api.com.atproto.server.reserveSigningKey({})
    const rotationKey = await Secp256k1Keypair.create()
    const plcCreate = await plcLib.createOp({
      signingKey,
      rotationKeys: [rotationKey.did(), entryway.ctx.plcRotationKey.did()],
      handle: 'weirdalice.test',
      pds: pds.ctx.cfg.service.publicUrl,
      signer: rotationKey,
    })
    const tryCreateAccount = pdsAgent.api.com.atproto.server.createAccount({
      did: plcCreate.did,
      plcOp: plcCreate.op,
      handle: 'weirdalice.test',
    })
    await expect(tryCreateAccount).rejects.toThrow('invalid plc operation')
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
    modServiceUrl: 'https://mod.invalid',
    modServiceDid: 'did:example:invalid',
    ...config,
  }
  const cfg = pdsEntryway.envToCfg(env)
  const secrets = pdsEntryway.envToSecrets(env)
  const server = await pdsEntryway.PDS.create(cfg, secrets)
  await server.ctx.db.migrateToLatestOrThrow()
  await server.start()
  // patch entryway access token verification to handle internal service auth pds -> entryway
  const origValidateAccessToken =
    server.ctx.authVerifier.validateAccessToken.bind(server.ctx.authVerifier)
  server.ctx.authVerifier.validateAccessToken = async (req, scopes) => {
    const jwt = req.headers.authorization?.replace('Bearer ', '') ?? ''
    const claims = decodeJwt(jwt)
    if (claims.aud === 'did:example:entryway') {
      assert(claims.lxm === parseReqNsid(req), 'bad lxm claim in service auth')
      assert(claims.aud, 'missing aud claim in service auth')
      assert(claims.iss, 'missing iss claim in service auth')
      return {
        artifacts: jwt,
        credentials: {
          type: 'access',
          scope: 'com.atproto.access' as any,
          audience: claims.aud,
          did: claims.iss,
        },
      }
    }
    return origValidateAccessToken(req, scopes)
  }
  // @TODO temp hack because entryway teardown calls signupActivator.run() by mistake
  server.ctx.signupActivator.run = server.ctx.signupActivator.destroy
  return server
}

const getPublicHex = (key: Secp256k1Keypair) => {
  return key.publicKeyStr('hex')
}

const getPrivateHex = async (key: Secp256k1Keypair) => {
  return ui8.toString(await key.export(), 'hex')
}
