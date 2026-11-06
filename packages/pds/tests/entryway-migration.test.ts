import { jest } from '@jest/globals'
import getPort from 'get-port'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import {
  SeedClient,
  TestPds,
  TestPlc,
  mockNetworkUtilities,
  mockResolvers,
} from '@atproto/dev-env'
import type { DidDocument } from '@atproto/identity'
import type { DidString } from '@atproto/syntax'
import { createServiceJwt } from '@atproto/xrpc-server'
import { com } from '../src/lexicons/index.js'
import { MockEntryway } from './entryway-mock.js'

const ENTRYWAY_DID = 'did:web:entryway.test'
const PDS_DID = 'did:example:pds'

describe('entryway account migration', () => {
  let plc: TestPlc
  let pds: TestPds
  let oldPds: TestPds
  let entryway: MockEntryway
  let pdsAgent: AtpAgent
  let entrywayAgent: AtpAgent

  beforeAll(async () => {
    const jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const entrywayPort = await getPort()
    plc = await TestPlc.create({})
    pds = await TestPds.create({
      entrywayUrl: `http://localhost:${entrywayPort}`,
      entrywayDid: ENTRYWAY_DID,
      entrywayJwtVerifyKeyK256PublicKeyHex: jwtSigningKey.publicKeyStr('hex'),
      entrywayPlcRotationKey: plcRotationKey.did(),
      adminPassword: 'admin-pass',
      serviceHandleDomains: ['.test'],
      bskyAppViewUrl: undefined,
      bskyAppViewDid: undefined,
      didPlcUrl: plc.url,
      serviceDid: PDS_DID,
      inviteRequired: false,
    })
    oldPds = await TestPds.create({
      didPlcUrl: plc.url,
      inviteRequired: false,
    })
    entryway = await MockEntryway.create({
      port: entrywayPort,
      serviceDid: ENTRYWAY_DID,
      plcUrl: plc.url,
      pdsUrl: pds.url,
      pdsDid: PDS_DID,
      adminPassword: 'admin-pass',
      jwtSigningKey,
      plcRotationKey,
    })
    mockNetworkUtilities(oldPds)
    mockResolvers(pds.ctx.idResolver, pds, entryway.url)
    mockResolvers(entryway.idResolver, pds, entryway.url)
    pdsAgent = pds.getAgent()
    entrywayAgent = new AtpAgent({ service: entryway.url })
  })

  afterAll(async () => {
    await oldPds?.close()
    await entryway?.destroy()
    await pds?.close()
    await plc?.close()
  })

  const createOldAccount = async (name: string) => {
    const agent = oldPds.getAgent()
    const res = await agent.createAccount({
      email: `${name}@test.com`,
      handle: `${name}.test`,
      password: `${name}-pass`,
    })
    return { agent, did: res.data.did as DidString }
  }

  it('migrates a did:plc account in via the entryway', async () => {
    const { agent: oldAgent, did } = await createOldAccount('alice')
    for (let i = 0; i < 3; i++) {
      await oldAgent.com.atproto.repo.createRecord({
        repo: did,
        collection: 'app.bsky.feed.post',
        record: {
          $type: 'app.bsky.feed.post',
          text: `post ${i}`,
          createdAt: new Date().toISOString(),
        },
      })
    }

    const serviceAuth = await oldAgent.com.atproto.server.getServiceAuth({
      aud: ENTRYWAY_DID,
      lxm: com.atproto.server.createAccount.$lxm,
    })

    const created = await entrywayAgent.com.atproto.server.createAccount(
      {
        did,
        handle: 'alice.test',
        email: 'alice@test.com',
        password: 'alice-pass',
      },
      {
        encoding: 'application/json',
        headers: { authorization: `Bearer ${serviceAuth.data.token}` },
      },
    )
    expect(created.data.did).toEqual(did)
    const headers = SeedClient.getHeaders(created.data.accessJwt)

    const account = await pds.ctx.accountManager.getAccount(did, {
      includeDeactivated: true,
    })
    expect(account?.handle).toEqual('alice.test')
    expect(account?.deactivatedAt).toBeTruthy()
    expect(entryway.getAccount(did)?.email).toEqual('alice@test.com')

    const status1 = await pdsAgent.com.atproto.server.checkAccountStatus(
      undefined,
      { headers },
    )
    expect(status1.data).toMatchObject({ activated: false, validDid: false })

    const repo = await oldAgent.com.atproto.sync.getRepo({ did })
    await pdsAgent.com.atproto.repo.importRepo(repo.data, {
      encoding: 'application/vnd.ipld.car',
      headers,
    })

    const creds =
      await pdsAgent.com.atproto.identity.getRecommendedDidCredentials(
        undefined,
        { headers },
      )
    expect(creds.data.rotationKeys).toContain(entryway.plcRotationKey.did())

    await oldAgent.com.atproto.identity.requestPlcOperationSignature()
    const { token } = await oldPds.ctx.accountManager.db.db
      .selectFrom('email_token')
      .select('token')
      .where('did', '=', did)
      .where('purpose', '=', 'plc_operation')
      .executeTakeFirstOrThrow()
    const signed = await oldAgent.com.atproto.identity.signPlcOperation({
      token,
      ...creds.data,
    })
    await pdsAgent.com.atproto.identity.submitPlcOperation(
      { operation: signed.data.operation },
      { encoding: 'application/json', headers },
    )

    await pdsAgent.com.atproto.server.activateAccount(undefined, { headers })

    const status2 = await pdsAgent.com.atproto.server.checkAccountStatus(
      undefined,
      { headers },
    )
    expect(status2.data).toMatchObject({
      activated: true,
      validDid: true,
      indexedRecords: 3,
    })
  })

  it('migrates a did:web account in via the entryway', async () => {
    const webKey = await Secp256k1Keypair.create()
    const webDid = 'did:web:alice.example.com'
    const webDoc: DidDocument = {
      id: webDid,
      alsoKnownAs: ['at://alice.example.com'],
      verificationMethod: [
        {
          id: '#atproto',
          type: 'Multikey',
          controller: webDid,
          publicKeyMultibase: webKey.did().slice('did:key:'.length),
        },
      ],
      service: [
        {
          id: '#atproto_pds',
          type: 'AtprotoPersonalDataServer',
          serviceEndpoint: 'https://old.example.com',
        },
      ],
    }
    const resolveWeb = async (did: string) => (did === webDid ? webDoc : null)
    using pdsWebSpy = jest
      .spyOn(pds.ctx.idResolver.did.methods.get('web')!, 'resolveNoCheck')
      .mockImplementation(resolveWeb)
    using entrywayWebSpy = jest
      .spyOn(entryway.idResolver.did.methods.get('web')!, 'resolveNoCheck')
      .mockImplementation(resolveWeb)

    const serviceJwt = await createServiceJwt({
      iss: webDid,
      aud: ENTRYWAY_DID,
      lxm: com.atproto.server.createAccount.$lxm,
      keypair: webKey,
    })

    const created = await entrywayAgent.com.atproto.server.createAccount(
      {
        did: webDid,
        handle: 'alice.example.com',
        email: 'alice-web@test.com',
        password: 'alice-web-pass',
      },
      {
        encoding: 'application/json',
        headers: { authorization: `Bearer ${serviceJwt}` },
      },
    )
    const headers = SeedClient.getHeaders(created.data.accessJwt)

    const account = await pds.ctx.accountManager.getAccount(webDid, {
      includeDeactivated: true,
    })
    expect(account?.deactivatedAt).toBeTruthy()

    // Cannot activate while the did doc still points at the old host
    await expect(
      pdsAgent.com.atproto.server.activateAccount(undefined, { headers }),
    ).rejects.toThrow()
    const status1 = await pdsAgent.com.atproto.server.checkAccountStatus(
      undefined,
      { headers },
    )
    expect(status1.data).toMatchObject({ activated: false, validDid: false })

    const creds =
      await pdsAgent.com.atproto.identity.getRecommendedDidCredentials(
        undefined,
        { headers },
      )
    expect(creds.data.rotationKeys).toBeUndefined()
    const newSigningKey = (
      creds.data.verificationMethods as { atproto: string }
    ).atproto

    // The user updates their did:web document themselves
    webDoc.verificationMethod![0].publicKeyMultibase = newSigningKey.slice(
      'did:key:'.length,
    )
    webDoc.service![0].serviceEndpoint = pds.ctx.cfg.service.publicUrl

    await pdsAgent.com.atproto.server.activateAccount(undefined, { headers })

    const status2 = await pdsAgent.com.atproto.server.checkAccountStatus(
      undefined,
      { headers },
    )
    expect(status2.data).toMatchObject({ activated: true, validDid: true })
    expect(pdsWebSpy).toHaveBeenCalled()
    expect(entrywayWebSpy).toHaveBeenCalled()
  })

  describe('direct calls to the pds', () => {
    let bob: DidString
    let bobServiceJwt: string

    beforeAll(async () => {
      const { agent, did } = await createOldAccount('bob')
      bob = did
      const res = await agent.com.atproto.server.getServiceAuth({
        aud: ENTRYWAY_DID,
        lxm: com.atproto.server.createAccount.$lxm,
      })
      bobServiceJwt = res.data.token
    })

    it('rejects a migration authenticated only by the user', async () => {
      await expect(
        pdsAgent.com.atproto.server.createAccount(
          { did: bob, handle: 'bob.test' },
          {
            encoding: 'application/json',
            headers: { authorization: `Bearer ${bobServiceJwt}` },
          },
        ),
      ).rejects.toThrow('entryway admin auth')
    })

    it('rejects an unauthenticated migration', async () => {
      await expect(
        pdsAgent.com.atproto.server.createAccount({
          did: bob,
          handle: 'bob.test',
        }),
      ).rejects.toThrow('entryway admin auth')
    })

    it('rejects account creation without a did', async () => {
      await expect(
        pdsAgent.com.atproto.server.createAccount({ handle: 'bob.test' }),
      ).rejects.toThrow('entryway pds requires bringing a DID')
    })

    it('rejects a migration to a taken handle', async () => {
      await expect(
        pdsAgent.com.atproto.server.createAccount(
          { did: bob, handle: 'alice.test' },
          { encoding: 'application/json', headers: pds.adminAuthHeaders() },
        ),
      ).rejects.toMatchObject({ error: 'HandleNotAvailable' })
    })
  })
})
