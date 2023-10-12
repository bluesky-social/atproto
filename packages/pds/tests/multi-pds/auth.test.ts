import assert from 'node:assert'
import fs from 'node:fs/promises'
import * as ui8 from 'uint8arrays'
import * as jose from 'jose'
import AtpAgent from '@atproto/api'
import { Secp256k1Keypair } from '@atproto/crypto'
import {
  SeedClient,
  TestPds,
  TestPlc,
  mockNetworkUtilities,
} from '@atproto/dev-env'
import { ids } from '@atproto/api/src/client/lexicons'

describe('multi-pds auth', () => {
  let plc: TestPlc
  let entryway: TestPds
  let entrywayAgent: AtpAgent
  let pds: TestPds
  let pdsAgent: AtpAgent
  let alice: string
  let accessToken: string

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
    })
    pds = await TestPds.create({
      dbPostgresUrl: process.env.DB_POSTGRES_URL,
      dbPostgresSchema: 'multi_pds_account_pds',
      didPlcUrl: plc.url,
      recoveryDidKey: recoveryKey,
      jwtVerifyKeyK256PublicKeyHex: jwtVerifyPub,
      jwtSigningKeyK256PrivateKeyHex: undefined, // no private key material on pds for jwts
      plcRotationKeyK256PrivateKeyHex: plcRotationPriv,
    })
    await entryway.ctx.db.db
      .insertInto('pds')
      .values({
        did: pds.ctx.cfg.service.did,
        host: new URL(pds.ctx.cfg.service.publicUrl).host,
      })
      .execute()
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
    const {
      data: { did },
    } = await entrywayAgent.api.com.atproto.server.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'test123',
    })

    // @TODO move these steps into account creation process
    await entryway.ctx.services.repo(entryway.ctx.db).deleteRepo(did)
    await plc
      .getClient()
      .updatePds(did, pds.ctx.plcRotationKey, pds.ctx.cfg.service.publicUrl)
    await plc
      .getClient()
      .updateAtprotoKey(
        did,
        pds.ctx.plcRotationKey,
        pds.ctx.repoSigningKey.did(),
      )

    alice = did
    await pdsAgent.api.com.atproto.server.createAccount({
      did,
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'test123',
    })

    const entrywayAccount = await entryway.ctx.services
      .account(entryway.ctx.db)
      .getAccount(did)
    assert(entrywayAccount)
    expect(entrywayAccount.did).toBe(did)
    expect(entrywayAccount.pdsId).not.toBe(null)
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
  })

  it('creates a session that auths across services.', async () => {
    const { data: session } =
      await entrywayAgent.api.com.atproto.server.createSession({
        identifier: alice,
        password: 'test123',
      })
    accessToken = session.accessJwt
    const tokenHeader = jose.decodeProtectedHeader(accessToken)
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
    expect(entrywayResult.did).toBe(alice)
    expect(pdsResult.did).toBe(alice)
  })

  describe('entryway', () => {
    it('proxies writes to pds.', async () => {
      const { data: profileRef } =
        await entrywayAgent.com.atproto.repo.createRecord(
          {
            repo: alice,
            collection: ids.AppBskyActorProfile,
            rkey: 'self',
            record: { displayName: 'Alice' },
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
            record: { displayName: 'Alice!' },
          },
          {
            headers: SeedClient.getHeaders(accessToken),
            encoding: 'application/json',
          },
        )
      const { data: profileUpdated } =
        await pdsAgent.com.atproto.repo.getRecord({
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
          record: { displayName: 'Alice', avatar: blob },
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

    it('proxies repo reads to pds.', async () => {
      const { data: profileRef } =
        await entrywayAgent.com.atproto.repo.putRecord(
          {
            repo: alice,
            collection: ids.AppBskyActorProfile,
            rkey: 'self',
            record: { displayName: 'Alice' },
          },
          {
            headers: SeedClient.getHeaders(accessToken),
            encoding: 'application/json',
          },
        )
      const { data: results } =
        await entrywayAgent.com.atproto.repo.listRecords({
          repo: alice,
          collection: ids.AppBskyActorProfile,
        })
      expect(results.records.map((record) => record.uri)).toContain(
        profileRef.uri,
      )
    })

    it('initiates token refresh when account moves off of entryway.', async () => {
      // don't assign bob to separate pds
      await entryway.ctx.db.db.updateTable('pds').set({ weight: 0 }).execute()
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
      await plc
        .getClient()
        .updatePds(did, pds.ctx.plcRotationKey, pds.ctx.cfg.service.publicUrl)
      await plc
        .getClient()
        .updateAtprotoKey(
          did,
          pds.ctx.plcRotationKey,
          pds.ctx.repoSigningKey.did(),
        )
      const { id: pdsId } = await entryway.ctx.db.db
        .updateTable('pds')
        .set({ weight: 1 })
        .returningAll()
        .executeTakeFirstOrThrow()
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
      await expect(tryPutRecord).rejects.toThrow(
        'Token audience is out of date',
      )
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
  })
})
