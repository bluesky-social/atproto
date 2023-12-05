import assert from 'node:assert'
import fs from 'node:fs/promises'
import * as ui8 from 'uint8arrays'
import * as jose from 'jose'
import AtpAgent from '@atproto/api'
import { XRPCError } from '@atproto/xrpc'
import { Secp256k1Keypair } from '@atproto/crypto'
import { getPdsEndpoint, isValidDidDoc } from '@atproto/common'
import {
  SeedClient,
  TestPds,
  TestPlc,
  mockNetworkUtilities,
} from '@atproto/dev-env'
import { ids } from '@atproto/api/src/client/lexicons'

describe('entryway', () => {
  let plc: TestPlc
  let entryway: TestPds
  let entrywayAgent: AtpAgent
  let pds: TestPds
  let pdsAgent: AtpAgent
  let alice: string
  let accessToken: string
  let refreshToken: string
  let pdsId: number

  beforeAll(async () => {
    const jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    const jwtSigningPriv = ui8.toString(await jwtSigningKey.export(), 'hex')
    const jwtVerifyPub = jwtSigningKey.publicKeyStr('hex')
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationPriv = ui8.toString(await plcRotationKey.export(), 'hex')
    const recoveryKey = (await Secp256k1Keypair.create()).did()
    plc = await TestPlc.create({})
    entryway = await TestPds.create({
      dbPostgresUrl: process.env.DB_POSTGRES_URL,
      dbPostgresSchema: 'multi_pds_account_entryway',
      didPlcUrl: plc.url,
      recoveryDidKey: recoveryKey,
      jwtSigningKeyK256PrivateKeyHex: jwtSigningPriv,
      plcRotationKeyK256PrivateKeyHex: plcRotationPriv,
      enableDidDocWithSession: true,
    })
    pds = await TestPds.create({
      // @NOTE plc rotation key and recovery key intentionally not matching entryway
      isEntryway: false,
      dbPostgresUrl: process.env.DB_POSTGRES_URL,
      dbPostgresSchema: 'multi_pds_account_pds',
      didPlcUrl: plc.url,
      jwtVerifyKeyK256PublicKeyHex: jwtVerifyPub,
      jwtSigningKeyK256PrivateKeyHex: undefined, // no private key material on pds for jwts
    })
    const pdsRow = await entryway.ctx.db.db
      .insertInto('pds')
      .values({
        did: pds.ctx.cfg.service.did,
        host: new URL(pds.ctx.cfg.service.publicUrl).host,
        weight: 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    pdsId = pdsRow.id
    mockNetworkUtilities([entryway, pds])
    entrywayAgent = entryway.getClient()
    pdsAgent = pds.getClient()
  })

  afterAll(async () => {
    await plc.close()
    await entryway.close()
    await pds.close()
  })

  it('assigns user to a pds.', async () => {
    await entryway.ctx.db.db.updateTable('pds').set({ weight: 1 }).execute()
    const {
      data: { did, ...initialSession },
    } = await entrywayAgent.api.com.atproto.server.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'test123',
    })
    alice = did
    await entryway.ctx.db.db.updateTable('pds').set({ weight: 0 }).execute()

    assert(isValidDidDoc(initialSession.didDoc))
    expect(initialSession.didDoc.id).toBe(alice)
    expect(getPdsEndpoint(initialSession.didDoc)).toBe(pds.url)

    const token = jose.decodeJwt(initialSession.accessJwt)
    expect(token.aud).toBe(pds.ctx.cfg.service.did)

    const entrywayAccount = await entryway.ctx.services
      .account(entryway.ctx.db)
      .getAccount(did)
    assert(entrywayAccount)
    expect(entrywayAccount.did).toBe(did)
    expect(entrywayAccount.pdsId).toBe(pdsId)
    expect(entrywayAccount.pdsDid).toBe(pds.ctx.cfg.service.did)
    expect(entrywayAccount.root).toBe(null)

    const pdsAccount = await pds.ctx.services
      .account(pds.ctx.db)
      .getAccount(did)
    assert(pdsAccount)
    expect(pdsAccount.did).toBe(did)
    expect(pdsAccount.pdsId).toBe(null)
    expect(pdsAccount.pdsDid).toBe(null)
    expect(pdsAccount.root).not.toBe(null)

    const plcClient = plc.getClient()
    const doc = await plcClient.getDocumentData(alice)
    expect(doc.did).toBe(alice)
    expect(doc.alsoKnownAs).toEqual(['at://alice.test'])
    expect(doc.services['atproto_pds'].endpoint).toBe(
      pds.ctx.cfg.service.publicUrl,
    )
    expect(doc.verificationMethods.atproto).toBe(pds.ctx.repoSigningKey.did())
    expect(doc.rotationKeys).toEqual([
      entryway.ctx.cfg.identity.recoveryDidKey,
      entryway.ctx.plcRotationKey.did(),
    ])
  })

  it('creates a session that auths across services.', async () => {
    const { data: session } =
      await entrywayAgent.api.com.atproto.server.createSession({
        identifier: alice,
        password: 'test123',
      })

    accessToken = session.accessJwt
    refreshToken = session.refreshJwt
    assert(isValidDidDoc(session.didDoc))
    expect(session.didDoc.id).toBe(alice)
    expect(getPdsEndpoint(session.didDoc)).toBe(pds.url)

    const tokenBody = jose.decodeJwt(accessToken)
    const tokenHeader = jose.decodeProtectedHeader(accessToken)
    expect(tokenBody.aud).toBe(pds.ctx.cfg.service.did)
    expect(tokenHeader.alg).toBe('ES256K') // asymmetric, from the jwt key and not the secret

    const { data: entrywayResult } =
      await entrywayAgent.api.com.atproto.server.getSession(
        {},
        { headers: SeedClient.getHeaders(accessToken) },
      )
    const { data: pdsResult } =
      await pdsAgent.api.com.atproto.server.getSession(
        {},
        { headers: SeedClient.getHeaders(accessToken) },
      )
    assert(isValidDidDoc(entrywayResult.didDoc))
    expect(entrywayResult.didDoc.id).toBe(alice)
    expect(getPdsEndpoint(entrywayResult.didDoc)).toBe(pds.url)
    expect(entrywayResult.did).toBe(alice)
    expect(pdsResult.did).toBe(alice)
  })

  it('refreshes a session on entryway that auths across services.', async () => {
    const { data: entrywaySession } =
      await entrywayAgent.api.com.atproto.server.refreshSession(undefined, {
        headers: SeedClient.getHeaders(refreshToken),
      })
    accessToken = entrywaySession.accessJwt
    refreshToken = entrywaySession.refreshJwt
    assert(isValidDidDoc(entrywaySession.didDoc))
    expect(entrywaySession.didDoc.id).toBe(alice)
    expect(getPdsEndpoint(entrywaySession.didDoc)).toBe(pds.url)
    const { data: entrywayResult } =
      await entrywayAgent.api.com.atproto.server.getSession(
        {},
        { headers: SeedClient.getHeaders(accessToken) },
      )
    const { data: pdsResult } =
      await pdsAgent.api.com.atproto.server.getSession(
        {},
        { headers: SeedClient.getHeaders(accessToken) },
      )
    expect(entrywayResult.did).toBe(alice)
    expect(pdsResult.did).toBe(alice)
  })

  it('refreshes a session on pds that auths across services.', async () => {
    const { data: pdsSession } =
      await entrywayAgent.api.com.atproto.server.refreshSession(undefined, {
        headers: SeedClient.getHeaders(refreshToken),
      })
    accessToken = pdsSession.accessJwt
    refreshToken = pdsSession.refreshJwt
    const { data: entrywayResult } =
      await entrywayAgent.api.com.atproto.server.getSession(
        {},
        { headers: SeedClient.getHeaders(accessToken) },
      )
    const { data: pdsResult } =
      await pdsAgent.api.com.atproto.server.getSession(
        {},
        { headers: SeedClient.getHeaders(accessToken) },
      )
    expect(entrywayResult.did).toBe(alice)
    expect(pdsResult.did).toBe(alice)
  })

  it('proxies writes to pds.', async () => {
    const { data: profileRef } =
      await entrywayAgent.com.atproto.repo.createRecord(
        {
          repo: alice,
          collection: ids.AppBskyActorProfile,
          rkey: 'self',
          record: { displayName: 'Alice 1' },
        },
        {
          headers: SeedClient.getHeaders(accessToken),
          encoding: 'application/json',
        },
      )
    const { data: profile } = await pdsAgent.com.atproto.repo.getRecord({
      repo: alice,
      collection: ids.AppBskyActorProfile,
      rkey: 'self',
    })
    expect(profile.cid).toBe(profileRef.cid)
    const { data: profileRefUpdated } =
      await entrywayAgent.com.atproto.repo.putRecord(
        {
          repo: alice,
          collection: ids.AppBskyActorProfile,
          rkey: 'self',
          record: { displayName: 'Alice 2' },
        },
        {
          headers: SeedClient.getHeaders(accessToken),
          encoding: 'application/json',
        },
      )
    const { data: profileUpdated } = await pdsAgent.com.atproto.repo.getRecord({
      repo: alice,
      collection: ids.AppBskyActorProfile,
      rkey: 'self',
    })
    expect(profileUpdated.cid).toBe(profileRefUpdated.cid)
    await entrywayAgent.com.atproto.repo.deleteRecord(
      {
        repo: alice,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
      },
      {
        headers: SeedClient.getHeaders(accessToken),
        encoding: 'application/json',
      },
    )
    const tryGetProfile = pdsAgent.com.atproto.repo.getRecord({
      repo: alice,
      collection: ids.AppBskyActorProfile,
      rkey: 'self',
    })
    await expect(tryGetProfile).rejects.toThrow('Could not locate record')
  })

  it('proxies blob uploads to pds.', async () => {
    const file = await fs.readFile('tests/sample-img/key-portrait-small.jpg')
    const {
      data: { blob },
    } = await entrywayAgent.api.com.atproto.repo.uploadBlob(file, {
      encoding: 'image/jpeg',
      headers: SeedClient.getHeaders(accessToken),
    })
    await entrywayAgent.com.atproto.repo.putRecord(
      {
        repo: alice,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record: { displayName: 'Alice 3', avatar: blob },
      },
      {
        headers: SeedClient.getHeaders(accessToken),
        encoding: 'application/json',
      },
    )
    const { data: bytes } = await pdsAgent.com.atproto.sync.getBlob({
      did: alice,
      cid: blob.ref.toString(),
    })
    expect(Buffer.compare(file, bytes)).toBe(0)
  })

  it('redirects blob uploads to pds.', async () => {
    const file = await fs.readFile('tests/sample-img/key-portrait-small.jpg')
    const {
      data: { blob },
    } = await entrywayAgent.api.com.atproto.repo.uploadBlob(file, {
      encoding: 'image/jpeg',
      headers: SeedClient.getHeaders(accessToken),
    })
    await entrywayAgent.com.atproto.repo.putRecord(
      {
        repo: alice,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record: { displayName: 'Alice 4', avatar: blob },
      },
      {
        headers: SeedClient.getHeaders(accessToken),
        encoding: 'application/json',
      },
    )
    // check with fetch to confirm redirect
    const url = new URL(
      '/xrpc/com.atproto.sync.getBlob',
      entrywayAgent.service.origin,
    )
    url.searchParams.set('did', alice)
    url.searchParams.set('cid', blob.ref.toString())
    const fetchResult = await fetch(url)
    expect(fetchResult.redirected).toBe(true)
    const fetchBlob = await fetchResult.blob()
    const fetchBytes = Buffer.from(await fetchBlob.arrayBuffer())
    expect(Buffer.compare(file, fetchBytes)).toBe(0)
    // check with atp agent to ensure our client handles the redirect
    const { data: bytes } = await entrywayAgent.com.atproto.sync.getBlob({
      did: alice,
      cid: blob.ref.toString(),
    })
    expect(Buffer.compare(file, bytes)).toBe(0)
  })

  it('proxies repo reads to pds.', async () => {
    const { data: profileRef } = await entrywayAgent.com.atproto.repo.putRecord(
      {
        repo: alice,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record: { displayName: 'Alice 5' },
      },
      {
        headers: SeedClient.getHeaders(accessToken),
        encoding: 'application/json',
      },
    )
    const { data: results } = await entrywayAgent.com.atproto.repo.listRecords({
      repo: alice,
      collection: ids.AppBskyActorProfile,
    })
    expect(results.records.map((record) => [record.uri, record.cid])).toEqual([
      [profileRef.uri, profileRef.cid],
    ])
  })

  it('initiates token refresh when account moves off of entryway.', async () => {
    const {
      data: { did, ...initialSession },
    } = await entrywayAgent.api.com.atproto.server.createAccount({
      email: 'bob@test.com',
      handle: 'bob.test',
      password: 'test123',
    })
    // use initial session credentials for a write
    await entrywayAgent.com.atproto.repo.putRecord(
      {
        repo: did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record: { displayName: 'Bob' },
      },
      {
        headers: SeedClient.getHeaders(initialSession.accessJwt),
        encoding: 'application/json',
      },
    )
    // now move bob to a separate pds
    await entryway.ctx.services.repo(entryway.ctx.db).deleteRepo(did)
    const plcClient = plc.getClient()
    await plcClient.updatePds(
      did,
      entryway.ctx.plcRotationKey,
      pds.ctx.cfg.service.publicUrl,
    )
    await plcClient.updateAtprotoKey(
      did,
      entryway.ctx.plcRotationKey,
      pds.ctx.repoSigningKey.did(),
    )
    await entryway.ctx.db.db
      .updateTable('user_account')
      .set({ pdsId })
      .where('did', '=', did)
      .returningAll()
      .executeTakeFirst()
    await pdsAgent.api.com.atproto.server.createAccount({
      did,
      email: 'bob@test.com',
      handle: 'bob.test',
      password: 'test123',
    })
    // attempt a write again on bob's original pds with same creds
    const tryPutRecord = entrywayAgent.com.atproto.repo.putRecord(
      {
        repo: did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record: { displayName: 'Bob!' },
      },
      {
        headers: SeedClient.getHeaders(initialSession.accessJwt),
        encoding: 'application/json',
      },
    )
    await expect(tryPutRecord).rejects.toThrow('Token audience is out of date')
    const err = await tryPutRecord.catch((err) => err)
    expect(err.status).toBe(400)
    expect(err.error).toBe('ExpiredToken')
    // refresh session and try again
    const { data: session } =
      await entrywayAgent.com.atproto.server.refreshSession(undefined, {
        headers: SeedClient.getHeaders(initialSession.refreshJwt),
      })
    await entrywayAgent.com.atproto.repo.putRecord(
      {
        repo: did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record: { displayName: 'Bob!' },
      },
      {
        headers: SeedClient.getHeaders(session.accessJwt),
        encoding: 'application/json',
      },
    )
    const { data: profile } = await pdsAgent.com.atproto.repo.getRecord({
      repo: did,
      collection: ids.AppBskyActorProfile,
      rkey: 'self',
    })
    expect(profile.value['displayName']).toEqual('Bob!')
  })

  it('initiates token refresh when account moves off of pds.', async () => {
    const {
      data: { did, ...initialSession },
    } = await entrywayAgent.api.com.atproto.server.createAccount({
      email: 'carol@test.com',
      handle: 'carol.test',
      password: 'test123',
    })
    const outdatedAccessToken = await entryway.ctx.services
      .auth(entryway.ctx.db)
      .createAccessToken({
        did,
        pdsDid: pds.ctx.cfg.service.did, // pretending that carol was previously on this pds
      })
    // attempt a write again on carol's previous pds with same creds
    const tryPutRecord = entrywayAgent.com.atproto.repo.putRecord(
      {
        repo: did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record: { displayName: 'Carol!' },
      },
      {
        headers: SeedClient.getHeaders(outdatedAccessToken),
        encoding: 'application/json',
      },
    )
    await expect(tryPutRecord).rejects.toThrow('Token audience is out of date')
    const err = await tryPutRecord.catch((err) => err)
    expect(err.status).toBe(400)
    expect(err.error).toBe('ExpiredToken')
    // refresh session and try again
    const { data: session } =
      await entrywayAgent.com.atproto.server.refreshSession(undefined, {
        headers: SeedClient.getHeaders(initialSession.refreshJwt),
      })
    await entrywayAgent.com.atproto.repo.putRecord(
      {
        repo: did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record: { displayName: 'Carol!' },
      },
      {
        headers: SeedClient.getHeaders(session.accessJwt),
        encoding: 'application/json',
      },
    )
    const { data: profile } = await entrywayAgent.com.atproto.repo.getRecord({
      repo: did,
      collection: ids.AppBskyActorProfile,
      rkey: 'self',
    })
    expect(profile.value['displayName']).toEqual('Carol!')
  })

  describe('agent sessions', () => {
    let dan: string

    it('updates service url on account creation based on did doc.', async () => {
      await entryway.ctx.db.db.updateTable('pds').set({ weight: 1 }).execute()
      const agent = new AtpAgent({ service: entryway.url })
      const { data: session } = await agent.createAccount({
        email: 'dan@test.com',
        handle: 'dan.test',
        password: 'test123',
      })
      dan = session.did
      await entryway.ctx.db.db.updateTable('pds').set({ weight: 0 }).execute()
      expect(session.handle).toBe('dan.test')
      assert(isValidDidDoc(session.didDoc))
      expect(session.didDoc.alsoKnownAs).toEqual(['at://dan.test'])
      expect(getPdsEndpoint(session.didDoc)).toBe(pds.url)
      expect(agent.api.xrpc.uri.origin).toBe(pds.url)
    })

    it('updates service url on session creation, resumption based on did doc.', async () => {
      // creation
      const agent1 = new AtpAgent({ service: entryway.url })
      expect(agent1.api.xrpc.uri.origin).toBe(entryway.url)
      const { data: session } = await agent1.login({
        identifier: 'dan.test',
        password: 'test123',
      })
      assert(agent1.session)
      const agentSession = agent1.session
      expect(session.handle).toBe('dan.test')
      assert(isValidDidDoc(session.didDoc))
      expect(session.didDoc.alsoKnownAs).toEqual(['at://dan.test'])
      expect(getPdsEndpoint(session.didDoc)).toBe(pds.url)
      expect(agent1.api.xrpc.uri.origin).toBe(pds.url)
      // resumption
      const agent2 = new AtpAgent({ service: entryway.url })
      expect(agent2.api.xrpc.uri.origin).toBe(entryway.url)
      const { data: resumedSession } = await agent2.resumeSession(agentSession)
      expect(resumedSession.handle).toBe('dan.test')
      assert(isValidDidDoc(resumedSession.didDoc))
      expect(resumedSession.didDoc.alsoKnownAs).toEqual(['at://dan.test'])
      expect(getPdsEndpoint(resumedSession.didDoc)).toBe(pds.url)
      expect(agent2.api.xrpc.uri.origin).toBe(pds.url)
    })

    it('updates service url on session refresh based on did doc.', async () => {
      const agent = new AtpAgent({ service: entryway.url })
      const authService = entryway.ctx.services.auth(entryway.ctx.db)
      const { refresh: refreshToken } = await authService.createSession({
        did: dan,
        pdsDid: pds.ctx.cfg.service.did,
        appPasswordName: null,
      })
      const expiredAccessToken = await authService.createAccessToken({
        did: dan,
        pdsDid: pds.ctx.cfg.service.did,
        expiresIn: -1,
      })
      agent.session = {
        did: dan,
        handle: 'dan.test',
        accessJwt: expiredAccessToken,
        refreshJwt: refreshToken,
      }
      expect(agent.api.xrpc.uri.origin).toBe(entryway.url)
      // since access token is expired, will cause a refresh flow
      await agent.com.atproto.server.getAccountInviteCodes()
      expect(agent.api.xrpc.uri.origin).toBe(pds.url)
      expect(agent.session).toBeDefined()
      expect(agent.session.accessJwt).not.toBe(expiredAccessToken)
      expect(agent.session.refreshJwt).not.toBe(refreshToken)
    })

    it('initiates token refresh when pds sees unknown user.', async () => {
      const { data: session } =
        await entrywayAgent.api.com.atproto.server.createAccount({
          email: 'eve@test.com',
          handle: 'eve.test',
          password: 'test123',
        })
      const authService = entryway.ctx.services.auth(entryway.ctx.db)
      const tokens = await authService.createSession({
        did: session.did,
        pdsDid: pds.ctx.cfg.service.did, // not eve's pds
        appPasswordName: null,
      })
      const attempt = (agent: AtpAgent) =>
        agent.api.app.bsky.actor.putPreferences(
          { preferences: [] },
          {
            headers: SeedClient.getHeaders(tokens.access),
            encoding: 'application/json',
          },
        )
      const pdsDirectErr = await attempt(pdsAgent).catch((err) => err)
      const entrywayProxyErr = await attempt(entrywayAgent).catch((err) => err)
      assert(pdsDirectErr instanceof XRPCError)
      assert(entrywayProxyErr instanceof XRPCError)
      expect(pdsDirectErr.status).toBe(403)
      expect(pdsDirectErr.error).toBe('AccountNotFound')
      expect(entrywayProxyErr.status).toBe(400)
      expect(entrywayProxyErr.error).toBe('ExpiredToken')
      // refresh handled by agent
      const agent = new AtpAgent({ service: entryway.url })
      agent.session = {
        did: session.did,
        handle: session.handle,
        accessJwt: tokens.access,
        refreshJwt: tokens.refresh,
      }
      expect(agent.api.xrpc.uri.origin).toBe(entryway.url)
      // since entryway serves an expiration error, will cause a refresh flow
      await agent.api.app.bsky.actor.putPreferences({ preferences: [] })
      expect(agent.api.xrpc.uri.origin).toBe(entryway.url)
      expect(agent.session).toBeDefined()
      expect(agent.session.accessJwt).not.toBe(tokens.access)
      expect(agent.session.refreshJwt).not.toBe(tokens.refresh)
    })
  })
})
