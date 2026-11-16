import { rm } from 'node:fs/promises'
import { jest } from '@jest/globals'
import getPort from 'get-port'
import { AtpAgent } from '@atproto/api'
import { wait } from '@atproto/common'
import { P256Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc, mockResolvers } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import type { DidString, HandleString } from '@atproto/syntax'
import { com, internal } from '../src/lexicons/index.js'
import { createPlcOp } from '../src/util/plc.js'
import { MockEntryway } from './entryway-mock.js'

describe('entryway spaces migration', () => {
  let plc: TestPlc
  let pds: TestPds
  let entryway: MockEntryway
  let entrywayAgent: AtpAgent
  let client: Client
  let plcRotationKey: Secp256k1Keypair

  beforeAll(async () => {
    const jwtSigningKey = await Secp256k1Keypair.create({ exportable: true })
    plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const entrywayPort = await getPort()
    plc = await TestPlc.create({})
    pds = await TestPds.create({
      entrywayUrl: `http://localhost:${entrywayPort}`,
      entrywayDid: 'did:example:entryway',
      entrywayJwtVerifyKeyK256PublicKeyHex: jwtSigningKey.publicKeyStr('hex'),
      entrywayPlcRotationKey: plcRotationKey.did(),
      adminPassword: 'admin-pass',
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
    entrywayAgent = new AtpAgent({ service: entryway.url })
    client = new Client({ service: pds.url })
  })

  afterAll(async () => {
    await plc?.close()
    await entryway?.destroy()
    await pds?.close()
  })

  afterEach(() => {
    entryway.includeKemKey = true
  })

  let counter = 0
  const createAccount = async (opts: { includeKemKey?: boolean } = {}) => {
    entryway.includeKemKey = opts.includeKemKey ?? true
    const n = counter++
    const res = await entrywayAgent.com.atproto.server.createAccount({
      email: `ews${n}@test.com`,
      handle: `ews${n}.test`,
      password: 'hunter2',
    })
    return res.data.did as DidString
  }

  const row = (did: DidString) => pds.ctx.spacesMigration.progress.get(did)

  const publishedKem = async (did: DidString) => {
    const { verificationMethods } = await pds.ctx.plcClient.getDocumentData(did)
    return verificationMethods.atproto_kem
  }

  const heldKem = async (did: DidString) =>
    (await pds.ctx.actorStore.kemKeypair(did))?.did()

  const check = (did: DidString) =>
    client.call(
      internal.pds.checkSpacesMigration,
      { did },
      { headers: pds.adminAuthHeaders() },
    )

  it('creates entryway accounts with a reserved, published kem key', async () => {
    using reserve = jest.spyOn(pds.ctx.actorStore, 'reserveKemKeypair')
    const did = await createAccount()

    expect(reserve).toHaveBeenCalledTimes(1)
    const reserved = await reserve.mock.results[0].value
    expect(await heldKem(did)).toBe(reserved)
    expect(await publishedKem(did)).toBe(reserved)
    expect((await row(did))?.kemPublishedAt).toEqual(expect.any(String))
    // The reservation is cleared once the account holds the key
    expect(
      await pds.ctx.actorStore.getReservedKemKeypair(reserved as string),
    ).toBeUndefined()
  })

  it('creates entryway accounts whose genesis op omits the kem key', async () => {
    const did = await createAccount({ includeKemKey: false })

    expect(await publishedKem(did)).toBeUndefined()
    expect(await heldKem(did)).toEqual(expect.any(String))
    expect(await row(did)).toMatchObject({
      kemPublishedAt: null,
      unpublishableReason: null,
    })
  })

  it('rejects a genesis op with an unreserved kem key', async () => {
    const { signingKey } = await client.call(
      com.atproto.server.reserveSigningKey,
      {},
    )
    const handle = 'ewsunreserved.test' as HandleString
    const attempt = async (kemKey: string, rejection: object) => {
      const { did, op } = await createPlcOp({
        signingKey,
        kemKey,
        rotationKeys: [plcRotationKey.did()],
        handle,
        pds: pds.ctx.cfg.service.publicUrl,
        signer: plcRotationKey,
      })
      await expect(
        client.call(com.atproto.server.createAccount, {
          did: did as DidString,
          handle,
          plcOp: op,
        }),
      ).rejects.toMatchObject(rejection)
      expect(await pds.ctx.actorStore.exists(did)).toBe(false)
    }

    await attempt((await P256Keypair.create()).did(), {
      error: 'IncorrectKemKey',
      message: 'Unknown KEM key',
    })
    // Reservations are looked up by path: a key that isn't a did:key must
    // never reach that lookup
    await attempt('did:key:../../key', { error: 'IncompatibleDidDoc' })
  })

  it('prepares and completes an account for the entryway', async () => {
    const did = await createAccount({ includeKemKey: false })
    // As left by the release before spaces: no kem key on disk
    const { kemKeyLocation } = await pds.ctx.actorStore.getLocation(did)
    await rm(kemKeyLocation)
    using sequenceIdentity = jest.spyOn(pds.ctx.sequencer, 'sequenceIdentity')

    const kemKey = await entryway.publishKemKey(did)

    expect(await heldKem(did)).toBe(kemKey)
    expect(await publishedKem(did)).toBe(kemKey)
    expect(sequenceIdentity).toHaveBeenCalledWith(did)
    expect(await row(did)).toMatchObject({
      kemPublishedAt: expect.any(String),
      unpublishableReason: null,
    })
  })

  it('refuses to complete before the key is published', async () => {
    const did = await createAccount({ includeKemKey: false })
    using sequenceIdentity = jest.spyOn(pds.ctx.sequencer, 'sequenceIdentity')

    await entryway.prepareSpacesMigration(did)
    await expect(entryway.completeSpacesMigration(did)).rejects.toMatchObject({
      error: 'KemKeyNotPublished',
      message: 'KEM key not published',
    })

    expect(sequenceIdentity).not.toHaveBeenCalled()
    expect((await row(did))?.kemPublishedAt).toBeNull()
  })

  it('never publishes from the pds in entryway mode', async () => {
    const did = await createAccount({ includeKemKey: false })
    const { publisher } = pds.ctx.spacesMigration
    expect(publisher.state).toBe('entryway')

    publisher.start()
    publisher.wake()
    await wait(200)

    expect(publisher.state).toBe('entryway')
    expect(await pds.ctx.plcClient.getOperationLog(did)).toHaveLength(1)
    expect((await row(did))?.kemPublishedAt).toBeNull()
  })

  it('check re-queues an account whose published key was dropped', async () => {
    const did = await createAccount()
    const kemKey = await heldKem(did)
    expect((await row(did))?.kemPublishedAt).toEqual(expect.any(String))
    await pds.ctx.plcClient.updateData(did, plcRotationKey, (op) => {
      const { atproto_kem: _, ...verificationMethods } = op.verificationMethods
      return { ...op, verificationMethods }
    })
    const opsBefore = await pds.ctx.plcClient.getOperationLog(did)
    using sequenceIdentity = jest.spyOn(pds.ctx.sequencer, 'sequenceIdentity')

    const res = await check(did)

    expect(res).toEqual({
      did,
      storeMigrated: true,
      kemKey,
      kemPublished: false,
    })
    expect(await row(did)).toMatchObject({
      kemPublishedAt: null,
      unpublishableReason: null,
      nextAttemptAt: 0,
    })
    expect(await pds.ctx.plcClient.getOperationLog(did)).toEqual(opsBefore)
    expect(sequenceIdentity).not.toHaveBeenCalled()
  })

  it('check leaves a correctly recorded published key alone', async () => {
    const did = await createAccount()
    const recorded = (await row(did))?.kemPublishedAt

    const res = await check(did)

    expect(res).toMatchObject({
      kemPublished: true,
      recordedPublishedAt: recorded,
    })
    expect((await row(did))?.kemPublishedAt).toBe(recorded)
  })

  it('check records a key the owner published themselves', async () => {
    const did = 'did:web:ewsweb.test' as DidString
    const signingKey = await Secp256k1Keypair.create({ exportable: true })
    const kemKey = await P256Keypair.create({ exportable: true })
    await pds.ctx.actorStore.create(did, signingKey, kemKey)
    const commit = await pds.ctx.actorStore.transact(did, (txn) =>
      txn.repo.createRepo([]),
    )
    await pds.ctx.accountManager.createAccount({
      did,
      handle: 'ewsweb.test' as HandleString,
      repoCid: commit.cid,
      repoRev: commit.rev,
    })
    await pds.ctx.spacesMigration.progress.recordChecked(did, {
      published: false,
      unpublishableReason: 'did-web',
    })
    using resolve = jest
      .spyOn(pds.ctx.idResolver.did, 'resolve')
      .mockImplementation(async () => ({
        '@context': [],
        id: did,
        verificationMethod: [
          {
            id: `${did}#atproto_kem`,
            type: 'Multikey',
            controller: did,
            publicKeyMultibase: kemKey.did().replace('did:key:', ''),
          },
        ],
      }))
    using sequenceIdentity = jest.spyOn(pds.ctx.sequencer, 'sequenceIdentity')

    const res = await check(did)

    expect(resolve).toHaveBeenCalledWith(did, true)
    expect(res).toEqual({
      did,
      storeMigrated: true,
      kemKey: kemKey.did(),
      kemPublished: true,
      recordedPublishedAt: expect.any(String),
    })
    expect(await row(did)).toMatchObject({
      kemPublishedAt: res.recordedPublishedAt,
      unpublishableReason: null,
    })
    expect(sequenceIdentity).not.toHaveBeenCalled()
  })

  it('check requires admin auth', async () => {
    const did = await createAccount()
    await expect(
      client.call(internal.pds.checkSpacesMigration, { did }),
    ).rejects.toMatchObject({ error: 'AuthenticationRequired' })
    const badAuth = Buffer.from('admin:wrong').toString('base64')
    await expect(
      client.call(
        internal.pds.checkSpacesMigration,
        { did },
        { headers: { authorization: `Basic ${badAuth}` } },
      ),
    ).rejects.toMatchObject({ error: 'AuthenticationRequired' })
  })

  it('prepare and complete require admin or entryway auth', async () => {
    const did = await createAccount({ includeKemKey: false })
    await expect(
      client.call(internal.pds.prepareSpacesMigration, { did }),
    ).rejects.toMatchObject({ error: 'AuthenticationRequired' })
    await expect(
      client.call(internal.pds.completeSpacesMigration, { did }),
    ).rejects.toMatchObject({ error: 'AuthenticationRequired' })
  })

  it('prepare refuses an account it does not host', async () => {
    const did = 'did:plc:ewsnotfound0000000000000' as DidString
    await expect(entryway.prepareSpacesMigration(did)).rejects.toMatchObject({
      error: 'NotFound',
    })
    await expect(check(did)).rejects.toMatchObject({ error: 'NotFound' })
  })
})

describe('spaces migration endpoints without an entryway', () => {
  let plc: TestPlc
  let pds: TestPds
  let client: Client

  beforeAll(async () => {
    plc = await TestPlc.create({})
    pds = await TestPds.create({
      didPlcUrl: plc.url,
      // Nowhere to proxy an unregistered method to
      bskyAppViewUrl: undefined,
      bskyAppViewDid: undefined,
      // Only the endpoints under test may touch the record
      spacesMigrationDisabled: true,
    })
    client = new Client({ service: pds.url })
  })

  afterAll(async () => {
    await pds?.close()
    await plc?.close()
  })

  it('does not expose the entryway endpoints', async () => {
    const { did, accessJwt } = await client.call(
      com.atproto.server.createAccount,
      {
        email: 'ewsnotexposed@test.com',
        handle: 'ewsnotexposed.test',
        password: 'hunter2',
      },
    )
    // An unregistered method falls through to the proxy, which serves a user
    // nothing for it. A registered one would refuse the user's token.
    const headers = { authorization: `Bearer ${accessJwt}` }
    const notServed = (nsid: string) => ({
      error: 'InvalidRequest',
      message: `No service configured for ${nsid}`,
    })
    await expect(
      client.call(internal.pds.reserveKemKey, {}, { headers }),
    ).rejects.toMatchObject(notServed(internal.pds.reserveKemKey.$lxm))
    await expect(
      client.call(internal.pds.prepareSpacesMigration, { did }, { headers }),
    ).rejects.toMatchObject(notServed(internal.pds.prepareSpacesMigration.$lxm))
    await expect(
      client.call(internal.pds.completeSpacesMigration, { did }, { headers }),
    ).rejects.toMatchObject(
      notServed(internal.pds.completeSpacesMigration.$lxm),
    )
  })

  it('checks accounts with admin auth', async () => {
    const { did } = await client.call(com.atproto.server.createAccount, {
      email: 'ewsnoentryway@test.com',
      handle: 'ewsnoentryway.test',
      password: 'hunter2',
    })
    const res = await client.call(
      internal.pds.checkSpacesMigration,
      { did },
      { headers: pds.adminAuthHeaders() },
    )
    expect(res).toEqual({
      did,
      storeMigrated: true,
      kemKey: (await pds.ctx.actorStore.kemKeypair(did))?.did(),
      kemPublished: true,
      recordedPublishedAt: expect.any(String),
    })
    await expect(
      client.call(internal.pds.checkSpacesMigration, { did }),
    ).rejects.toMatchObject({ error: 'AuthenticationRequired' })
  })
})
