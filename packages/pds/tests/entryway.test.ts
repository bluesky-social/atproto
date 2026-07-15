import assert from 'node:assert'
import * as plcLib from '@did-plc/lib'
import getPort from 'get-port'
import { request } from 'undici'
import { AtpAgent } from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import { SeedClient, TestPds, TestPlc, mockResolvers } from '@atproto/dev-env'
import { isDidString } from '@atproto/lex'
import type { DidString, HandleString } from '@atproto/syntax'
import { MockEntryway } from './entryway-mock.js'

describe('entryway', () => {
  let plc: TestPlc
  let pds: TestPds
  let entryway: MockEntryway
  let pdsAgent: AtpAgent
  let entrywayAgent: AtpAgent
  let alice: DidString
  let accessToken: string

  beforeAll(async () => {
    const jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const entrywayPort = await getPort()
    plc = await TestPlc.create({})
    pds = await TestPds.create({
      entrywayUrl: `http://localhost:${entrywayPort}`,
      entrywayDid: 'did:example:entryway',
      entrywayJwtVerifyKeyK256PublicKeyHex: jwtSigningKey.publicKeyStr('hex'),
      entrywayPlcRotationKey: plcRotationKey.did(),
      adminPassword: 'admin-pass',
      // matches the entryway's handle domains, which it makes resolvable
      serviceHandleDomains: ['.test'],
      bskyAppViewUrl: undefined,
      bskyAppViewDid: undefined,
      didPlcUrl: plc.url,
      serviceDid: 'did:example:pds',
      inviteRequired: false,
    })
    entryway = await MockEntryway.create({
      port: entrywayPort,
      serviceDid: 'did:example:entryway',
      plcUrl: plc.url,
      pdsUrl: pds.url,
      pdsDid: 'did:example:pds',
      adminPassword: 'admin-pass',
      jwtSigningKey,
      plcRotationKey,
    })
    mockResolvers(pds.ctx.idResolver, pds, entryway.url)
    mockResolvers(entryway.idResolver, pds, entryway.url)
    pdsAgent = pds.getAgent()
    entrywayAgent = new AtpAgent({
      service: entryway.url,
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

    assert(isDidString(res.data.did), 'Account DID is not a valid DidString')

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
    const accountFromEntryway = entryway.getAccount(alice)
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
    const doc = await entryway.idResolver.did.resolve(alice)
    const handleToDid = await entryway.idResolver.handle.resolve('alice3.test')
    const accountFromPds = await pds.ctx.accountManager.getAccount(alice)
    const accountFromEntryway = entryway.getAccount(alice)
    expect(doc?.alsoKnownAs).toEqual(['at://alice3.test'])
    expect(handleToDid).toEqual(alice)
    expect(accountFromPds?.handle).toEqual('alice3.test')
    expect(accountFromEntryway?.handle).toEqual('alice3.test')
  })

  it('resolves handle of local account via entryway.', async () => {
    const res = await pdsAgent.api.com.atproto.identity.resolveHandle({
      handle: 'alice3.test',
    })
    expect(res.data.did).toEqual(alice)
  })

  it('does not resolve handle from local account store.', async () => {
    // known locally but not by the entryway, e.g. local state that diverged
    await pds.ctx.accountManager.updateAccountHandle(
      alice,
      'alice-diverged.test' as HandleString,
    )
    try {
      const attempt = pdsAgent.api.com.atproto.identity.resolveHandle({
        handle: 'alice-diverged.test',
      })
      await expect(attempt).rejects.toThrow('Unable to resolve handle')
    } finally {
      await pds.ctx.accountManager.updateAccountHandle(
        alice,
        'alice3.test' as HandleString,
      )
    }
  })

  it('resolves handle of account behind entryway on another pds.', async () => {
    entryway.addAccount({
      did: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa' as DidString,
      handle: 'sibling.test' as HandleString,
    })
    const res = await pdsAgent.api.com.atproto.identity.resolveHandle({
      handle: 'sibling.test',
    })
    expect(res.data.did).toEqual('did:plc:aaaaaaaaaaaaaaaaaaaaaaaa')
  })

  it('fails to resolve unknown handle on service domain.', async () => {
    const attempt = pdsAgent.api.com.atproto.identity.resolveHandle({
      handle: 'nonexistent.test',
    })
    await expect(attempt).rejects.toThrow('Unable to resolve handle')
  })

  it('defers handle resolution over well-known to entryway.', async () => {
    const resPds = await request(new URL('/.well-known/atproto-did', pds.url), {
      headers: { host: 'alice3.test' },
    })
    expect(resPds.statusCode).toEqual(404)
    await resPds.body.dump()

    const resEntryway = await request(
      new URL('/.well-known/atproto-did', entryway.url),
      { headers: { host: 'alice3.test' } },
    )
    expect(resEntryway.statusCode).toEqual(200)
    await expect(resEntryway.body.text()).resolves.toEqual(alice)
  })

  it('does not allow bringing own op to account creation.', async () => {
    const {
      data: { signingKey },
    } = await pdsAgent.api.com.atproto.server.reserveSigningKey({})
    const rotationKey = await Secp256k1Keypair.create()
    const plcCreate = await plcLib.createOp({
      signingKey,
      rotationKeys: [rotationKey.did(), entryway.plcRotationKey.did()],
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
