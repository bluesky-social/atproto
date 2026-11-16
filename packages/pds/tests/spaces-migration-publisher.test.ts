import { randomUUID } from 'node:crypto'
import * as plc from '@did-plc/lib'
import { jest } from '@jest/globals'
import { HOUR, wait } from '@atproto/common'
import { P256Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import {
  type DidString,
  type HandleString,
  currentDatetimeString,
} from '@atproto/syntax'
import type { AccountDb } from '../src/account-manager/db/index.js'
import type { AppContext } from '../src/context.js'
import { SpacesMigrationProgress } from '../src/spaces-migration/progress.js'
import {
  SpacesMigrationPublisher,
  type SpacesMigrationPublisherOptions,
} from '../src/spaces-migration/publisher.js'

describe('spaces migration publisher', () => {
  let plcServer: TestPlc
  let pds: TestPds
  let ctx: AppContext
  let db: AccountDb
  let progress: SpacesMigrationProgress

  beforeAll(async () => {
    plcServer = await TestPlc.create({})
    pds = await TestPds.create({
      didPlcUrl: plcServer.url,
      // Only the publishers under test may publish
      spacesMigrationDisabled: true,
    })
    ctx = pds.ctx as unknown as AppContext
    db = ctx.accountManager.db
    progress = new SpacesMigrationProgress(db)
  })

  afterAll(async () => {
    await pds?.close()
    await plcServer?.close()
  })

  beforeEach(async () => {
    // Each test sees only its own unpublished accounts: park the others
    await db.db
      .updateTable('spaces_migration')
      .set({ nextAttemptAt: Number.MAX_SAFE_INTEGER, priority: 0 })
      .where('kemPublishedAt', 'is', null)
      .execute()
    await db.db.deleteFrom('spaces_migration_state').execute()
  })

  const publisher = (opts: Partial<SpacesMigrationPublisherOptions> = {}) => {
    const publisher = new SpacesMigrationPublisher(ctx, progress, {
      disabled: false,
      publishIntervalMs: 0,
      jitterWindowMs: 0,
      ...opts,
    })
    publisher.start()
    return publisher
  }

  const waitFor = async (check: () => Promise<boolean>, timeoutMs = 10_000) => {
    const deadline = Date.now() + timeoutMs
    while (!(await check())) {
      if (Date.now() > deadline) throw new Error('timed out')
      await wait(20)
    }
  }

  const row = async (did: string) => {
    return db.db
      .selectFrom('spaces_migration')
      .selectAll()
      .where('did', '=', did as DidString)
      .executeTakeFirst()
  }

  const isPublished = async (did: string) =>
    (await row(did))?.kemPublishedAt != null

  const publishedKem = async (did: string) => {
    const { verificationMethods } = await ctx.plcClient.getDocumentData(did)
    return verificationMethods.atproto_kem
  }

  const kemDid = async (did: string) =>
    (await ctx.actorStore.kemKeypair(did))?.did()

  let counter = 0
  const createAccount = async () => {
    const n = counter++
    const res = await pds.getAgent().com.atproto.server.createAccount({
      email: `pub${n}@test.com`,
      handle: `pub${n}.test`,
      password: 'hunter2',
    })
    return res.data.did as DidString
  }

  const updatePlc = (
    did: string,
    fn: (op: plc.UnsignedOperation) => Omit<plc.UnsignedOperation, 'prev'>,
  ) => ctx.plcClient.updateData(did, ctx.plcRotationKey, fn)

  // An account as left by the release before spaces: no kem key in its DID
  // doc, and no progress row until seeded.
  const createPreSpacesAccount = async () => {
    const did = await createAccount()
    await updatePlc(did, (op) => {
      const { atproto_kem: _, ...verificationMethods } = op.verificationMethods
      return { ...op, verificationMethods }
    })
    await db.db.deleteFrom('spaces_migration').where('did', '=', did).execute()
    await progress.seed()
    return did
  }

  const kemOps = async (did: string) => {
    const log = await ctx.plcClient.getAuditableLog(did)
    return log.filter(
      (entry) =>
        entry.operation.type === 'plc_operation' &&
        entry.operation.verificationMethods.atproto_kem !== undefined,
    )
  }

  it('records new accounts as already published', async () => {
    using sequenceIdentity = jest.spyOn(ctx.sequencer, 'sequenceIdentity')
    const did = await createAccount()
    const created = await row(did)
    expect(created?.kemPublishedAt).toEqual(expect.any(String))
    expect(created?.storeMigratedAt).toEqual(expect.any(String))

    const oauthStore = (pds.ctx.oauthProvider as any).accountManager.store
    const account = await oauthStore.createAccount({
      locale: 'en',
      handle: 'puboauth.test',
      email: 'puboauth@test.com',
      password: 'hunter2hunter2',
    })
    const oauthCreated = await row(account.did)
    expect(oauthCreated?.kemPublishedAt).toEqual(expect.any(String))
    expect(oauthCreated?.storeMigratedAt).toEqual(expect.any(String))

    await using _publisher = publisher()
    await waitFor(async () => _publisher.state === 'idle')
    expect(sequenceIdentity).not.toHaveBeenCalled()
    expect(await ctx.plcClient.getOperationLog(did)).toHaveLength(1)
    expect(await ctx.plcClient.getOperationLog(account.did)).toHaveLength(1)
  })

  it('publishes the kem key and sequences an identity event', async () => {
    const did = await createPreSpacesAccount()
    expect(await publishedKem(did)).toBeUndefined()
    using sequenceIdentity = jest.spyOn(ctx.sequencer, 'sequenceIdentity')

    await using _publisher = publisher()
    await waitFor(() => isPublished(did))

    expect(await publishedKem(did)).toBe(await kemDid(did))
    expect(sequenceIdentity).toHaveBeenCalledWith(did)
    const published = await row(did)
    expect(published).toMatchObject({
      unpublishableReason: null,
      attempts: 0,
      leaseOwner: null,
    })
  })

  it('creates a missing kem key before publishing it', async () => {
    const did = await createPreSpacesAccount()
    const { kemKeyLocation } = await ctx.actorStore.getLocation(did)
    const { rm } = await import('node:fs/promises')
    await rm(kemKeyLocation)

    await using _publisher = publisher()
    await waitFor(() => isPublished(did))

    const kem = await kemDid(did)
    expect(kem).toBeDefined()
    expect(await publishedKem(did)).toBe(kem)
  })

  it('marks did:web accounts unpublishable', async () => {
    const did = 'did:web:pubweb.test' as DidString
    const signingKey = await Secp256k1Keypair.create({ exportable: true })
    const kemKey = await P256Keypair.create({ exportable: true })
    await ctx.actorStore.create(did, signingKey, kemKey)
    const commit = await ctx.actorStore.transact(did, (txn) =>
      txn.repo.createRepo([]),
    )
    await ctx.accountManager.createAccount({
      did,
      handle: 'pubweb.test' as HandleString,
      repoCid: commit.cid,
      repoRev: commit.rev,
    })
    await progress.seed()
    using resolve = jest
      .spyOn(ctx.idResolver.did, 'resolve')
      .mockImplementation(async () => ({
        '@context': [],
        id: did,
        verificationMethod: [
          {
            id: `${did}#atproto`,
            type: 'Multikey',
            controller: did,
            publicKeyMultibase: signingKey.did().replace('did:key:', ''),
          },
        ],
      }))

    await using _publisher = publisher()
    await waitFor(async () => (await row(did))?.unpublishableReason != null)

    expect(resolve).toHaveBeenCalledWith(did, true)
    expect(await row(did)).toMatchObject({
      unpublishableReason: 'did-web',
      kemPublishedAt: null,
      leaseOwner: null,
    })
  })

  it('records did:web accounts that published the key themselves', async () => {
    const did = 'did:web:pubwebself.test' as DidString
    const signingKey = await Secp256k1Keypair.create({ exportable: true })
    const kemKey = await P256Keypair.create({ exportable: true })
    await ctx.actorStore.create(did, signingKey, kemKey)
    const commit = await ctx.actorStore.transact(did, (txn) =>
      txn.repo.createRepo([]),
    )
    await ctx.accountManager.createAccount({
      did,
      handle: 'pubwebself.test' as HandleString,
      repoCid: commit.cid,
      repoRev: commit.rev,
    })
    await progress.seed()
    using _resolve = jest
      .spyOn(ctx.idResolver.did, 'resolve')
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
    using sequenceIdentity = jest.spyOn(ctx.sequencer, 'sequenceIdentity')

    await using _publisher = publisher()
    await waitFor(() => isPublished(did))

    expect(sequenceIdentity).toHaveBeenCalledWith(did)
    expect((await row(did))?.unpublishableReason).toBeNull()
  })

  it('marks accounts whose rotation key was removed unpublishable', async () => {
    const did = await createPreSpacesAccount()
    const otherKey = await Secp256k1Keypair.create()
    await updatePlc(did, (op) => ({ ...op, rotationKeys: [otherKey.did()] }))

    await using _publisher = publisher()
    await waitFor(async () => (await row(did))?.unpublishableReason != null)

    expect((await row(did))?.unpublishableReason).toBe('rotation-key-not-held')
    expect(await kemOps(did)).toHaveLength(1) // genesis only
  })

  it('marks accounts hosted elsewhere unpublishable', async () => {
    const did = await createPreSpacesAccount()
    await updatePlc(did, (op) => ({
      ...op,
      services: {
        ...op.services,
        atproto_pds: {
          type: 'AtprotoPersonalDataServer',
          endpoint: 'https://elsewhere.test',
        },
      },
    }))

    await using _publisher = publisher()
    await waitFor(async () => (await row(did))?.unpublishableReason != null)

    expect((await row(did))?.unpublishableReason).toBe('pds-elsewhere')
    expect(await kemOps(did)).toHaveLength(1) // genesis only
  })

  it('marks tombstoned accounts unpublishable', async () => {
    const did = await createPreSpacesAccount()
    await ctx.plcClient.tombstone(did, ctx.plcRotationKey)

    await using _publisher = publisher()
    await waitFor(async () => (await row(did))?.unpublishableReason != null)

    expect((await row(did))?.unpublishableReason).toBe('tombstoned')
  })

  it('deletes the rows of accounts whose store is gone', async () => {
    const did = await createPreSpacesAccount()
    await ctx.actorStore.destroy(did)

    await using _publisher = publisher()
    await waitFor(async () => (await row(did)) === undefined)

    expect(await ctx.actorStore.kemKeypair(did)).toBeUndefined()
  })

  it('only sequences when a crash followed the plc update', async () => {
    const did = await createPreSpacesAccount()
    using sequenceIdentity = jest
      .spyOn(ctx.sequencer, 'sequenceIdentity')
      .mockRejectedValueOnce(new Error('crash'))
    using updateData = jest.spyOn(ctx.plcClient, 'updateData')

    {
      await using _publisher = publisher()
      await waitFor(async () => (await row(did))?.attempts === 1)
    }
    expect(await publishedKem(did)).toBe(await kemDid(did))
    expect(await isPublished(did)).toBe(false)
    expect(updateData).toHaveBeenCalledTimes(1)

    // Retry now rather than after the backoff
    await db.db
      .updateTable('spaces_migration')
      .set({ nextAttemptAt: 0 })
      .where('did', '=', did)
      .execute()
    await using _publisher = publisher()
    await waitFor(() => isPublished(did))

    expect(updateData).toHaveBeenCalledTimes(1)
    expect(sequenceIdentity).toHaveBeenCalledTimes(2)
    expect(await kemOps(did)).toHaveLength(2) // genesis and the publish
  })

  it('backs off the whole publisher on plc 429', async () => {
    const did = await createPreSpacesAccount()
    using updateData = jest
      .spyOn(ctx.plcClient, 'updateData')
      .mockRejectedValue(
        new plc.PlcClientError(429, undefined, 'Too Many Requests'),
      )

    await using pub = publisher()
    await waitFor(async () => pub.state === 'backoff')

    expect(updateData).toHaveBeenCalledTimes(1)
    expect(await row(did)).toMatchObject({
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
      leaseOwner: null,
      kemPublishedAt: null,
    })
    // Still backing off: the account isn't retried right away
    await wait(200)
    expect(updateData).toHaveBeenCalledTimes(1)
  })

  it('holds priority accounts while backing off', async () => {
    const first = await createPreSpacesAccount()
    const second = await createPreSpacesAccount()
    using updateData = jest
      .spyOn(ctx.plcClient, 'updateData')
      .mockRejectedValueOnce(
        new plc.PlcClientError(429, undefined, 'Too Many Requests'),
      )

    // Only priority accounts are due before the jitter delay ends
    await using pub = publisher({
      jitterWindowMs: HOUR,
      plcBackoffBaseMs: 1_000,
    })
    await waitFor(async () => pub.state === 'waiting')
    await progress.bump(first)
    pub.wake()
    await waitFor(async () => pub.state === 'backoff')
    const backoffAt = Date.now()

    await progress.bump(second)
    pub.wake()
    await wait(300)
    expect(updateData).toHaveBeenCalledTimes(1)
    expect(await isPublished(second)).toBe(false)

    // Both go once the backoff ends
    await waitFor(() => isPublished(first))
    await waitFor(() => isPublished(second))
    expect(Date.now() - backoffAt).toBeGreaterThanOrEqual(700)
    expect(updateData).toHaveBeenCalledTimes(3)
  })

  it('backs off a single account on other errors', async () => {
    const did = await createPreSpacesAccount()
    using _updateData = jest
      .spyOn(ctx.plcClient, 'updateData')
      .mockRejectedValue(new plc.PlcClientError(400, undefined, 'Bad op'))

    await using pub = publisher()
    await waitFor(async () => (await row(did))?.attempts === 1)

    const failed = await row(did)
    expect(failed?.lastError).toContain('Bad op')
    expect(failed?.nextAttemptAt).toBeGreaterThan(Date.now() + 30_000)
    expect(failed?.leaseOwner).toBeNull()
    expect(pub.state).not.toBe('backoff')
  })

  it('publishes each account once with two publishers', async () => {
    const dids = await Promise.all([
      createPreSpacesAccount(),
      createPreSpacesAccount(),
      createPreSpacesAccount(),
      createPreSpacesAccount(),
    ])
    using sequenceIdentity = jest.spyOn(ctx.sequencer, 'sequenceIdentity')

    {
      await using _a = publisher({ owner: randomUUID() })
      await using _b = publisher({ owner: randomUUID() })
      for (const did of dids) await waitFor(() => isPublished(did))
    }

    for (const did of dids) {
      // genesis, then one publish after the kem key was stripped
      expect(await kemOps(did)).toHaveLength(2)
      expect(
        sequenceIdentity.mock.calls.filter(([called]) => called === did),
      ).toHaveLength(1)
    }
  })

  it('keeps its publish start time across restarts', async () => {
    const first = await progress.publishStartAt('localhost', HOUR, 1_000)
    const second = await progress.publishStartAt('localhost', HOUR, 5_000_000)
    expect(first).toBeGreaterThanOrEqual(1_000)
    expect(first).toBeLessThan(1_000 + HOUR)
    expect(second).toBe(first)
  })

  it('publishes priority accounts before the jitter delay ends', async () => {
    const waiting = await createPreSpacesAccount()
    const bumped = await createPreSpacesAccount()
    expect(ctx.cfg.service.hostname).toBe('localhost')

    await using pub = publisher({
      jitterWindowMs: HOUR,
      publishIntervalMs: HOUR,
    })
    await waitFor(async () => pub.state === 'waiting')

    await progress.bump(bumped)
    pub.wake()
    await waitFor(() => isPublished(bumped))
    await waitFor(async () => pub.state === 'waiting')

    expect(await isPublished(waiting)).toBe(false)
    expect(await publishedKem(waiting)).toBeUndefined()
  })

  it('records an account failure and moves on', async () => {
    const failing = await createPreSpacesAccount()
    using _getLastOp = jest
      .spyOn(ctx.plcClient, 'getLastOp')
      .mockRejectedValueOnce(new Error('boom'))
    await progress.bump(failing) // claimed first

    await using pub = publisher()
    await waitFor(async () => (await row(failing))?.attempts === 1)
    expect((await row(failing))?.lastError).toContain('boom')

    const next = await createPreSpacesAccount()
    pub.wake()
    await waitFor(() => isPublished(next))
  })

  it('never throws out of the loop', async () => {
    const did = await createPreSpacesAccount()
    using claimDue = jest
      .spyOn(progress, 'claimDue')
      .mockRejectedValueOnce(new Error('db boom'))

    await using _pub = publisher({ pollIntervalMs: 20 })
    await waitFor(() => isPublished(did))
    expect(claimDue.mock.calls.length).toBeGreaterThan(1)
  })

  it('backs off the whole publisher when plc does not answer', async () => {
    const did = await createPreSpacesAccount()
    using getLastOp = jest
      .spyOn(ctx.plcClient, 'getLastOp')
      .mockImplementation(() => new Promise(() => {}))

    await using pub = publisher({ plcTimeoutMs: 50 })
    await waitFor(async () => pub.state === 'backoff')

    expect(getLastOp).toHaveBeenCalledTimes(1)
    expect(await row(did)).toMatchObject({
      attempts: 0,
      lastError: null,
      leaseOwner: null,
      kemPublishedAt: null,
    })
  })

  it('leaves no shutdown timer behind after stopping', async () => {
    // A distinctive delay picks out destroy()'s own timer
    const destroyTimeoutMs = 12_345
    const pub = publisher({ destroyTimeoutMs })
    await waitFor(async () => pub.state === 'idle')

    using setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout')
    using clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout')
    await pub.destroy()

    const shutdownTimers = setTimeoutSpy.mock.results
      .filter((_, i) => setTimeoutSpy.mock.calls[i][1] === destroyTimeoutMs)
      .map((result) => result.value)
    expect(shutdownTimers).toHaveLength(1)
    const cleared = clearTimeoutSpy.mock.calls.map(([timer]) => timer)
    expect(cleared).toContain(shutdownTimers[0])
  })

  it('bounds shutdown within a 10s stop grace by default', async () => {
    const pub = publisher()
    await waitFor(async () => pub.state === 'idle')
    using setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout')
    await pub.destroy()
    // Runs alongside the sweep's, so both fit Docker's default grace
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toContain(5_000)
  })

  it('stops promptly even with a step stuck', async () => {
    const did = await createPreSpacesAccount()
    using _sequenceIdentity = jest
      .spyOn(ctx.sequencer, 'sequenceIdentity')
      .mockImplementation(() => new Promise(() => {}))
    const pub = publisher({ destroyTimeoutMs: 50 })
    await waitFor(async () => (await publishedKem(did)) !== undefined)
    await wait(50) // into sequenceIdentity

    const started = Date.now()
    await pub.destroy()
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it('records the doc moving elsewhere just before the plc update', async () => {
    const did = await createPreSpacesAccount()
    const getLastOp = ctx.plcClient.getLastOp.bind(ctx.plcClient)
    using _getLastOp = jest
      .spyOn(ctx.plcClient, 'getLastOp')
      .mockImplementationOnce(async (did) => {
        const op = await getLastOp(did)
        // The user moves their PDS, keeping our rotation key
        await updatePlc(did, (op) => ({
          ...op,
          services: {
            ...op.services,
            atproto_pds: {
              type: 'AtprotoPersonalDataServer',
              endpoint: 'https://elsewhere.test',
            },
          },
        }))
        return op
      })

    await using _pub = publisher()
    await waitFor(async () => (await row(did))?.unpublishableReason != null)

    expect((await row(did))?.unpublishableReason).toBe('pds-elsewhere')
    expect(await kemOps(did)).toHaveLength(1) // genesis only
    expect(await publishedKem(did)).toBeUndefined()
  })

  it('does not publish after losing the lease', async () => {
    const did = await createPreSpacesAccount()
    const getLastOp = ctx.plcClient.getLastOp.bind(ctx.plcClient)
    using _getLastOp = jest
      .spyOn(ctx.plcClient, 'getLastOp')
      .mockImplementationOnce(async (did) => {
        const op = await getLastOp(did)
        // Another process takes the row, e.g. after this one stalled
        await db.db
          .updateTable('spaces_migration')
          .set({ leaseOwner: 'other', leaseExpiresAt: Date.now() + HOUR })
          .where('did', '=', did as DidString)
          .execute()
        return op
      })
    using updateData = jest.spyOn(ctx.plcClient, 'updateData')

    await using pub = publisher()
    await waitFor(async () => pub.state === 'idle')

    expect(updateData).not.toHaveBeenCalled()
    expect(await kemOps(did)).toHaveLength(1) // genesis only
    expect(await row(did)).toMatchObject({
      leaseOwner: 'other',
      attempts: 0,
      kemPublishedAt: null,
    })
  })

  it('leaves deactivated accounts until they are activated', async () => {
    // As an inbound migration: deactivated here, its DID doc still pointing
    // at the old PDS with the old PDS's rotation key
    const did = await createPreSpacesAccount()
    await ctx.accountManager.deactivateAccount(did)
    const oldPdsKey = await Secp256k1Keypair.create()
    await updatePlc(did, (op) => ({
      ...op,
      rotationKeys: [oldPdsKey.did()],
      services: {
        ...op.services,
        atproto_pds: {
          type: 'AtprotoPersonalDataServer',
          endpoint: 'https://old-pds.test',
        },
      },
    }))

    {
      await using pub = publisher()
      await waitFor(async () => pub.state === 'idle')
    }
    expect(await row(did)).toMatchObject({
      unpublishableReason: null,
      attempts: 0,
      kemPublishedAt: null,
      leaseOwner: null,
    })

    // The migration's PLC op points the DID here, then the account activates
    await ctx.plcClient.updateData(did, oldPdsKey, (op) => ({
      ...op,
      rotationKeys: [ctx.plcRotationKey.did()],
      services: {
        ...op.services,
        atproto_pds: {
          type: 'AtprotoPersonalDataServer',
          endpoint: ctx.cfg.service.publicUrl,
        },
      },
    }))
    await ctx.accountManager.activateAccount(did)

    await using _pub = publisher()
    await waitFor(() => isPublished(did))
    expect(await publishedKem(did)).toBe(await kemDid(did))
  })

  it('does not claim deactivated accounts', async () => {
    const did = await createPreSpacesAccount()
    await ctx.accountManager.deactivateAccount(did)
    using updateData = jest.spyOn(ctx.plcClient, 'updateData')

    await using pub = publisher()
    await waitFor(async () => pub.state === 'idle')

    expect(updateData).not.toHaveBeenCalled()
    expect(await row(did)).toMatchObject({
      attempts: 0,
      kemPublishedAt: null,
      leaseOwner: null,
    })
  })

  it('leaves seeding to the sweep', async () => {
    // Both start at boot; one seed scan of the actor table is enough
    using seed = jest.spyOn(progress, 'seed')
    await using pub = publisher()
    await waitFor(async () => pub.state === 'idle')
    expect(seed).not.toHaveBeenCalled()
  })

  it('stays out of the way when disabled', async () => {
    const did = await createPreSpacesAccount()
    await using pub = publisher({ disabled: true })
    await wait(100)
    expect(pub.state).toBe('disabled')
    expect(await isPublished(did)).toBe(false)
  })

  it('summarizes progress', async () => {
    await createPreSpacesAccount()
    const summary = await progress.summary()
    const actors = await db.db
      .selectFrom('actor')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow()
    expect(summary.total).toBe(Number(actors.count))
    expect(summary.keysPublished).toBeLessThan(summary.total)
    expect(summary).toEqual({
      total: expect.any(Number),
      storesMigrated: expect.any(Number),
      keysPublished: expect.any(Number),
      unpublishable: expect.any(Number),
      deactivated: expect.any(Number),
      failing: expect.any(Number),
      sweepFailing: expect.any(Number),
    })
  })

  it('counts pending deactivated accounts apart from failing ones', async () => {
    // Deactivated after a failed attempt: never claimed again until activated
    const did = await createPreSpacesAccount()
    await db.db
      .updateTable('spaces_migration')
      .set({ attempts: 1, lastError: 'boom' })
      .where('did', '=', did)
      .execute()
    const before = await progress.summary()
    await ctx.accountManager.deactivateAccount(did)

    const after = await progress.summary()
    expect(after.deactivated).toBe(before.deactivated + 1)
    expect(after.failing).toBe(before.failing - 1)
    expect(after.total).toBe(before.total)

    // A host is done once every account is published, unpublishable or
    // deactivated
    await db.db
      .updateTable('spaces_migration')
      .set({ kemPublishedAt: currentDatetimeString() })
      .where('kemPublishedAt', 'is', null)
      .where('unpublishableReason', 'is', null)
      .where('did', '!=', did)
      .execute()
    const done = await progress.summary()
    expect(done.total).toBe(
      done.keysPublished + done.unpublishable + done.deactivated,
    )
  })
})
