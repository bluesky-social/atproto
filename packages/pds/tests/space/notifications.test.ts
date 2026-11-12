import { jest } from '@jest/globals'
import {
  DAY,
  HOUR,
  MINUTE,
  SECOND,
  TID,
  createDeferrable,
} from '@atproto/common'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { type SpaceRefString, currentDatetimeString } from '@atproto/lex'
import { LtHash } from '@atproto/space'
import { SpaceRef } from '@atproto/syntax'
import { XRPCError } from '@atproto/xrpc-server'
import type { AccountDb } from '../../src/account-manager/db/index.js'
import { fromJson, toJson } from '../../src/db/index.js'
import { com } from '../../src/lexicons/index.js'
import { SpaceNotifications } from '../../src/space-notifications.js'
import { type Actor, MockService, SpaceClient } from '../_space.js'

describe('space notification retries', () => {
  let network: TestNetworkNoAppView
  let writer: Actor
  let outsider: Actor
  let host: MockService
  let space: SpaceRefString
  let localSpace: SpaceRefString
  let notifications: SpaceNotifications
  let db: AccountDb
  let status = 200
  let error: string | undefined

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'space_notification_retries',
    })
    const sc = new SpaceClient(network)
    writer = await sc.createActor('writer', network.pds)
    outsider = await sc.createActor('outsider', network.pds)
    localSpace = await sc.createSpace(writer, { skey: 'notifications' })
    host = await MockService.create(network, {
      serviceId: 'atproto_pds',
      respond: () => ({ status, body: error ? { error } : {} }),
    })
    space =
      `at://${host.did}/space/com.example.group/notifications` as SpaceRefString
    const ctx = network.pds.ctx
    await ctx.spaceNotifications.destroy()
    notifications = ctx.spaceNotifications = new SpaceNotifications(ctx)
    db = ctx.accountManager.db
  })

  beforeEach(async () => {
    status = 200
    error = undefined
    host.calls.length = 0
    await db.db.deleteFrom('space_notification_retry').execute()
    await db.db.deleteFrom('space_syncer_notification_retry').execute()
    await db.db
      .updateTable('space_notification_lease')
      .set({ owner: '', expiresAt: 0 })
      .execute()
  })

  afterAll(async () => {
    await host?.close()
    await network?.close()
  })

  const pending = () =>
    db.db
      .selectFrom('space_notification_retry')
      .selectAll()
      .executeTakeFirstOrThrow()

  const makeDue = () =>
    db.db.updateTable('space_notification_retry').set({ retryAt: 0 }).execute()

  it('sends immediately without queueing a successful notification', async () => {
    const commit = makeCommit()
    await notifications.notify(SpaceRef.parse(space), writer.did, commit)
    expect(host.callsTo(com.atproto.space.notifyRepoUpdate.$lxm)).toHaveLength(
      1,
    )
    expect(host.calls[0].body).toMatchObject({
      space,
      repo: writer.did,
      repoRev: commit.rev,
    })
    expect(
      await db.db.selectFrom('space_notification_retry').selectAll().execute(),
    ).toEqual([])
  })

  it('clears an older queued notification when a new write succeeds immediately', async () => {
    status = 503
    const older = makeCommit()
    await notifications.notify(SpaceRef.parse(space), writer.did, older)
    expect((await pending()).repoRev).toBe(older.rev)

    status = 200
    await notifications.notify(SpaceRef.parse(space), writer.did, makeCommit())
    expect(host.calls).toHaveLength(2)
    expect(
      await db.db.selectFrom('space_notification_retry').selectAll().execute(),
    ).toEqual([])
  })

  it.each([408, 425, 429, 500, 502, 503, 504, 522, 524])(
    'persists an HTTP %s response for retry',
    async (code) => {
      status = code
      const commit = makeCommit()
      const before = Date.now()
      await notifications.notify(SpaceRef.parse(space), writer.did, commit)
      const retry = await pending()
      expect(retry).toMatchObject({
        space,
        repo: writer.did,
        repoRev: commit.rev,
        attempts: 1,
      })
      expect(retry.expiresAt).toBeGreaterThanOrEqual(before + DAY)
      expect(retry.expiresAt).toBeLessThanOrEqual(Date.now() + DAY)
      await makeDue()
      await notifications.retryPending()
      expect((await pending()).attempts).toBe(2)
      expect(host.calls).toHaveLength(2)
    },
  )

  it('uses the HTTP status even when the XRPC error name suggests a rejection', async () => {
    status = 503
    error = 'Forbidden'
    await notifications.notify(SpaceRef.parse(space), writer.did, makeCommit())
    expect((await pending()).attempts).toBe(1)
    await makeDue()
    await notifications.retryPending()
    expect((await pending()).attempts).toBe(2)
  })

  it.each([400, 401, 403, 404, 422, 501])(
    'stops retrying HTTP %s with an unfamiliar XRPC error name',
    async (code) => {
      status = code
      error = 'CustomRejection'
      await notifications.notify(
        SpaceRef.parse(space),
        writer.did,
        makeCommit(),
      )
      expect(
        await db.db
          .selectFrom('space_notification_retry')
          .selectAll()
          .execute(),
      ).toEqual([])

      status = 503
      await notifications.notify(
        SpaceRef.parse(space),
        writer.did,
        makeCommit(),
      )
      expect((await pending()).attempts).toBe(1)
      await makeDue()
      status = code
      await notifications.retryPending()
      expect(
        await db.db
          .selectFrom('space_notification_retry')
          .selectAll()
          .execute(),
      ).toEqual([])
      expect(host.calls).toHaveLength(3)
    },
  )

  it.each([429, 503])('retries local HTTP %s failures', async (code) => {
    using _read = jest
      .spyOn(network.pds.ctx.actorStore, 'read')
      .mockRejectedValue(new XRPCError(code, 'temporary failure', 'Forbidden'))
    await notifications.notify(
      SpaceRef.parse(localSpace),
      writer.did,
      makeCommit(),
    )
    expect((await pending()).attempts).toBe(1)
    await makeDue()
    await notifications.retryPending()
    expect((await pending()).attempts).toBe(2)
    expect(host.calls).toHaveLength(0)
  })

  describe.each([
    { code: 403, reason: 'Forbidden' },
    { code: 400, reason: 'SpaceNotFound' },
  ])('$reason', ({ code, reason }) => {
    it('does not queue a rejected notification', async () => {
      status = code
      error = reason
      await notifications.notify(
        SpaceRef.parse(space),
        writer.did,
        makeCommit(),
      )
      expect(host.calls).toHaveLength(1)
      expect(
        await db.db
          .selectFrom('space_notification_retry')
          .selectAll()
          .execute(),
      ).toEqual([])
    })

    it.each(['notify', 'retry'])(
      'clears queued work when %s is rejected',
      async (attempt) => {
        status = 503
        await notifications.notify(
          SpaceRef.parse(space),
          writer.did,
          makeCommit(),
        )
        await makeDue()
        status = code
        error = reason
        if (attempt === 'notify') {
          await notifications.notify(
            SpaceRef.parse(space),
            writer.did,
            makeCommit(),
          )
        } else {
          await notifications.retryPending()
        }
        expect(host.calls).toHaveLength(2)
        expect(
          await db.db
            .selectFrom('space_notification_retry')
            .selectAll()
            .execute(),
        ).toEqual([])
        await notifications.retryPending()
        expect(host.calls).toHaveLength(2)
      },
    )

    it('stops on local authority rejections too', async () => {
      const target =
        reason === 'Forbidden'
          ? localSpace
          : (`${localSpace}-missing` as SpaceRefString)
      await notifications.notify(
        SpaceRef.parse(target),
        outsider.did,
        makeCommit(),
      )
      expect(
        await db.db
          .selectFrom('space_notification_retry')
          .selectAll()
          .execute(),
      ).toEqual([])

      {
        using _read = jest
          .spyOn(network.pds.ctx.actorStore, 'read')
          .mockRejectedValueOnce(new Error('database unavailable'))
        await notifications.notify(
          SpaceRef.parse(target),
          outsider.did,
          makeCommit(),
        )
      }
      expect(await pending()).toMatchObject({
        space: target,
        repo: outsider.did,
        attempts: 1,
      })
      await makeDue()
      await notifications.retryPending()
      expect(
        await db.db
          .selectFrom('space_notification_retry')
          .selectAll()
          .execute(),
      ).toEqual([])
      expect(host.calls).toHaveLength(0)
    })
  })

  it('persists failures before the HTTP request', async () => {
    using resolve = jest
      .spyOn(network.pds.ctx.idResolver.did, 'resolve')
      .mockRejectedValue(new Error('resolver unavailable'))
    const commit = makeCommit()
    await notifications.notify(SpaceRef.parse(space), writer.did, commit)
    expect(resolve).toHaveBeenCalled()
    expect(host.calls).toHaveLength(0)
    expect((await pending()).repoRev).toBe(commit.rev)
  })

  it('surfaces an error if the failed delivery cannot be queued', async () => {
    status = 503
    using _write = jest
      .spyOn(db, 'executeWithRetry')
      .mockRejectedValueOnce(new Error('database unavailable'))
    await expect(
      notifications.notify(SpaceRef.parse(space), writer.did, makeCommit()),
    ).rejects.toThrow('database unavailable')
    expect(host.calls).toHaveLength(1)
  })

  it('starts a fresh retry flow for a newer revision and ignores older or equal revisions', async () => {
    status = 503
    const older = makeCommit()
    const newer = makeCommit()
    newer.setHash[0] = 1
    await notifications.notify(SpaceRef.parse(space), writer.did, older)
    const retryAt = Date.now() + HOUR
    const expiresAt = Date.now() + DAY / 2
    await db.db
      .updateTable('space_notification_retry')
      .set({ attempts: 5, retryAt, expiresAt })
      .execute()
    const before = Date.now()
    await notifications.notify(SpaceRef.parse(space), writer.did, newer)
    const retry = await pending()
    expect(retry).toMatchObject({
      repoRev: newer.rev,
      attempts: 1,
    })
    expect(retry.retryAt).toBeGreaterThanOrEqual(before + MINUTE / 2)
    expect(retry.retryAt).toBeLessThanOrEqual(Date.now() + MINUTE)
    expect(retry.expiresAt).toBeGreaterThanOrEqual(before + DAY)
    expect(retry.expiresAt).toBeLessThanOrEqual(Date.now() + DAY)
    expect(new Uint8Array(retry.data)).toEqual(
      new LtHash(newer.setHash).digest(),
    )
    await notifications.notify(SpaceRef.parse(space), writer.did, older)
    await notifications.notify(SpaceRef.parse(space), writer.did, newer)
    expect(await pending()).toEqual(retry)
  })

  it.each([
    { code: 200, reason: undefined },
    { code: 403, reason: 'Forbidden' },
    { code: 400, reason: 'SpaceNotFound' },
  ])(
    'keeps newer queued work when an older delivery finishes with $code',
    async ({ code, reason }) => {
      const resolver = network.pds.ctx.idResolver.did
      const resolve = resolver.resolve.bind(resolver)
      const started = createDeferrable()
      const resume = createDeferrable()
      using _resolve = jest
        .spyOn(resolver, 'resolve')
        .mockImplementationOnce(async (...args) => {
          started.resolve()
          await resume.complete
          return resolve(...args)
        })
      const older = makeCommit()
      const newer = makeCommit()
      const inFlight = notifications.notify(
        SpaceRef.parse(space),
        writer.did,
        older,
      )
      try {
        await started.complete
        status = 503
        await notifications.notify(SpaceRef.parse(space), writer.did, newer)
        status = code
        error = reason
        resume.resolve()
        await inFlight
        expect((await pending()).repoRev).toBe(newer.rev)
        await notifications.notify(SpaceRef.parse(space), writer.did, newer)
        expect(
          await db.db
            .selectFrom('space_notification_retry')
            .selectAll()
            .execute(),
        ).toEqual([])
      } finally {
        resume.resolve()
        await inFlight
      }
    },
  )

  it('backs off failed retries, caps the delay, and only reads due work', async () => {
    status = 503
    await notifications.notify(SpaceRef.parse(space), writer.did, makeCommit())
    await notifications.retryPending()
    expect(host.calls).toHaveLength(1)

    await makeDue()
    const before = Date.now()
    using reads = jest.spyOn(network.pds.ctx.actorStore, 'read')
    await notifications.retryPending()
    expect(host.calls).toHaveLength(2)
    expect(reads).not.toHaveBeenCalled()
    const retry = await pending()
    expect(retry.attempts).toBe(2)
    expect(retry.retryAt).toBeGreaterThanOrEqual(before + MINUTE)
    expect(retry.retryAt).toBeLessThanOrEqual(Date.now() + 2 * MINUTE)

    await db.db
      .updateTable('space_notification_retry')
      .set({ attempts: 20, retryAt: 0 })
      .execute()
    const beforeCapped = Date.now()
    await notifications.retryPending()
    const capped = await pending()
    expect(capped.attempts).toBe(21)
    expect(capped.retryAt).toBeGreaterThanOrEqual(beforeCapped + HOUR / 2)
    expect(capped.retryAt).toBeLessThanOrEqual(Date.now() + HOUR)

    status = 200
    await makeDue()
    await notifications.retryPending()
    expect(
      await db.db.selectFrom('space_notification_retry').selectAll().execute(),
    ).toEqual([])
  })

  it.each([
    { code: 200, reason: undefined },
    { code: 503, reason: undefined },
    { code: 403, reason: 'Forbidden' },
    { code: 400, reason: 'SpaceNotFound' },
  ])(
    'preserves a fresh retry flow when an older retry finishes with $code',
    async ({ code, reason }) => {
      using _now = jest.spyOn(Date, 'now').mockReturnValue(Date.now())
      status = 503
      await notifications.notify(
        SpaceRef.parse(space),
        writer.did,
        makeCommit(),
      )
      await makeDue()
      const resolver = network.pds.ctx.idResolver.did
      const resolve = resolver.resolve.bind(resolver)
      const started = createDeferrable()
      const resume = createDeferrable()
      using _resolve = jest
        .spyOn(resolver, 'resolve')
        .mockImplementationOnce(async (...args) => {
          started.resolve()
          await resume.complete
          return resolve(...args)
        })
      const inFlight = notifications.retryPending()
      try {
        await started.complete
        const newer = makeCommit()
        await notifications.notify(SpaceRef.parse(space), writer.did, newer)
        const freshRetry = await pending()
        expect(freshRetry).toMatchObject({ repoRev: newer.rev, attempts: 1 })
        status = code
        error = reason
        resume.resolve()
        await inFlight
        expect(await pending()).toEqual(freshRetry)
        expect(host.calls).toHaveLength(3)
      } finally {
        resume.resolve()
        await inFlight
      }
    },
  )

  it('stops at the deadline and allows a later write to start a new retry window', async () => {
    status = 503
    await notifications.notify(SpaceRef.parse(space), writer.did, makeCommit())
    const expiresAt = Date.now() + MINUTE / 2
    await db.db
      .updateTable('space_notification_retry')
      .set({ retryAt: 0, expiresAt })
      .execute()
    await notifications.retryPending()
    expect((await pending()).retryAt).toBe(expiresAt)
    expect(host.calls).toHaveLength(2)

    {
      using _now = jest.spyOn(Date, 'now').mockReturnValue(expiresAt)
      await notifications.retryPending()
      expect(host.calls).toHaveLength(2)
      expect(
        await db.db
          .selectFrom('space_notification_retry')
          .selectAll()
          .execute(),
      ).toEqual([])
    }

    const newer = makeCommit()
    const before = Date.now()
    await notifications.notify(SpaceRef.parse(space), writer.did, newer)
    const retry = await pending()
    expect(retry).toMatchObject({ repoRev: newer.rev, attempts: 1 })
    expect(retry.expiresAt).toBeGreaterThanOrEqual(before + DAY)
  })

  it('elects one retry worker and allows takeover after its lease expires', async () => {
    const ctx = network.pds.ctx
    await using first = new SpaceNotifications(ctx)
    await using second = new SpaceNotifications(ctx)
    await first.retryPending()
    const firstLease = await db.db
      .selectFrom('space_notification_lease')
      .selectAll()
      .executeTakeFirstOrThrow()

    status = 503
    await notifications.notify(SpaceRef.parse(space), writer.did, makeCommit())
    await makeDue()
    status = 200
    await second.retryPending()
    expect(host.calls).toHaveLength(1)
    expect((await pending()).attempts).toBe(1)

    await db.db
      .updateTable('space_notification_lease')
      .set({ expiresAt: 0 })
      .execute()
    await second.retryPending()
    expect(host.calls).toHaveLength(2)
    const secondLease = await db.db
      .selectFrom('space_notification_lease')
      .selectAll()
      .executeTakeFirstOrThrow()
    expect(secondLease.owner).not.toBe(firstLease.owner)
    expect(secondLease.expiresAt).toBeGreaterThan(Date.now())

    await first.destroy()
    expect(
      await db.db
        .selectFrom('space_notification_lease')
        .selectAll()
        .executeTakeFirstOrThrow(),
    ).toEqual(secondLease)
    await second.destroy()
    await first.retryPending()
    expect(
      await db.db
        .selectFrom('space_notification_lease')
        .select('expiresAt')
        .executeTakeFirstOrThrow(),
    ).toEqual({ expiresAt: 0 })
  })

  it('defers retries for inactive accounts and resumes after activation', async () => {
    status = 503
    await notifications.notify(SpaceRef.parse(space), writer.did, makeCommit())
    await makeDue()
    await db.db
      .updateTable('actor')
      .set({ deactivatedAt: currentDatetimeString() })
      .where('did', '=', writer.did)
      .execute()
    try {
      status = 200
      await notifications.retryPending()
      expect(host.calls).toHaveLength(1)
      expect((await pending()).attempts).toBe(2)
    } finally {
      await db.db
        .updateTable('actor')
        .set({ deactivatedAt: null })
        .where('did', '=', writer.did)
        .execute()
    }
    await makeDue()
    await notifications.retryPending()
    expect(host.calls).toHaveLength(2)
  })

  describe('syncer notices', () => {
    const { spaceDeleted, registrationExpired } =
      com.atproto.space.notifySpaceUpdate
    let syncer: MockService
    let syncerStatus = 200
    let deletedSpace: SpaceRefString

    beforeAll(async () => {
      const sc = new SpaceClient(network)
      deletedSpace = await sc.createSpace(writer, { skey: 'deleted' })
      await network.pds.ctx.spacePolicyManager.deleteSpace(
        SpaceRef.parse(deletedSpace),
      )
      syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
        respond: () => ({ status: syncerStatus, body: {} }),
      })
    })

    beforeEach(async () => {
      syncerStatus = 200
      syncer.calls.length = 0
      await network.pds.ctx.actorStore.transact(writer.did, (txn) =>
        txn.space.removeNotifyRegistration(localSpace, registration()),
      )
    })

    afterAll(async () => {
      await syncer?.close()
    })

    const registration = () => ({ endpoint: syncer.url, token: 'syncer-token' })

    const pendingNotices = () =>
      db.db.selectFrom('space_syncer_notification_retry').selectAll().execute()

    const makeNoticesDue = () =>
      db.db
        .updateTable('space_syncer_notification_retry')
        .set({ retryAt: 0 })
        .execute()

    const notifyDeleted = () =>
      notifications.notifySyncers(
        SpaceRef.parse(deletedSpace),
        [registration()],
        spaceDeleted.$build({}),
      )

    // Expiry notices go to a lapsed registration in a space that still exists.
    const lapseRegistration = (expiresAt = Date.now() - MINUTE) =>
      network.pds.ctx.actorStore.transact(writer.did, (txn) =>
        txn.space.putNotifyRegistration({
          space: localSpace,
          ...registration(),
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      )

    const notifyExpired = () =>
      notifications.notifySyncers(
        SpaceRef.parse(localSpace),
        [registration()],
        registrationExpired.$build({ spaceRev: TID.nextStr() }),
      )

    const getRegistration = () =>
      network.pds.ctx.actorStore.read(writer.did, (store) =>
        store.space.getNotifyRegistration(localSpace, registration()),
      )

    it('sends immediately without queueing a successful notification', async () => {
      await notifyDeleted()
      const delivered = syncer.callsTo(com.atproto.space.notifySpaceUpdate.$lxm)
      expect(delivered).toHaveLength(1)
      expect(delivered[0].body).toEqual({
        space: deletedSpace,
        token: 'syncer-token',
        update: spaceDeleted.$build({}),
      })
      expect(await pendingNotices()).toEqual([])
    })

    it('retries a transient failure until delivered', async () => {
      syncerStatus = 503
      const before = Date.now()
      await notifyDeleted()
      const [retry] = await pendingNotices()
      expect(retry).toMatchObject({
        space: deletedSpace,
        endpoint: syncer.url,
        token: 'syncer-token',
        attempts: 1,
      })
      expect(retry.expiresAt).toBeGreaterThanOrEqual(before + 72 * HOUR)
      expect(retry.expiresAt).toBeLessThanOrEqual(Date.now() + 72 * HOUR)

      await makeNoticesDue()
      await notifications.retryPending()
      expect(await pendingNotices()).toMatchObject([{ attempts: 2 }])

      syncerStatus = 200
      await makeNoticesDue()
      await notifications.retryPending()
      expect(await pendingNotices()).toEqual([])
      expect(syncer.calls).toHaveLength(3)
      expect(syncer.calls.at(-1)?.body).toMatchObject({ token: 'syncer-token' })
    })

    it('does not retry a permanent failure', async () => {
      syncerStatus = 400
      await notifyDeleted()
      expect(await pendingNotices()).toEqual([])
      expect(syncer.calls).toHaveLength(1)
    })

    it('backs off from a minute to twelve hours', async () => {
      syncerStatus = 503
      await notifyDeleted()
      for (const delay of [
        MINUTE,
        10 * MINUTE,
        HOUR,
        6 * HOUR,
        12 * HOUR,
        12 * HOUR,
      ]) {
        const [retry] = await pendingNotices()
        const wait = retry.retryAt - Date.now()
        expect(wait).toBeGreaterThan(delay / 2 - SECOND)
        expect(wait).toBeLessThanOrEqual(delay)
        await makeNoticesDue()
        await notifications.retryPending()
      }
    })

    it('stops retrying after a final retry past 72 hours', async () => {
      syncerStatus = 503
      await notifyDeleted()
      await db.db
        .updateTable('space_syncer_notification_retry')
        .set({ retryAt: 0, expiresAt: Date.now() })
        .execute()
      await notifications.retryPending()
      expect(await pendingNotices()).toEqual([])
      expect(syncer.calls).toHaveLength(2)
    })

    it('drops retries once the authority account is gone', async () => {
      await db.db
        .insertInto('space_syncer_notification_retry')
        .values({
          space:
            'at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/space/com.example.group/gone' as SpaceRefString,
          endpoint: syncer.url,
          token: 'syncer-token',
          noticeJson: toJson(spaceDeleted.$build({})),
          attempts: 1,
          retryAt: 0,
          expiresAt: Date.now() + DAY,
        })
        .execute()
      await notifications.retryPending()
      expect(await pendingNotices()).toEqual([])
      expect(syncer.calls).toHaveLength(0)
    })

    it('defers retries while the authority is inactive', async () => {
      syncerStatus = 503
      await notifyDeleted()
      await makeNoticesDue()
      await db.db
        .updateTable('actor')
        .set({ deactivatedAt: currentDatetimeString() })
        .where('did', '=', writer.did)
        .execute()
      try {
        syncerStatus = 200
        await notifications.retryPending()
        expect(syncer.calls).toHaveLength(1)
        expect(await pendingNotices()).toMatchObject([{ attempts: 2 }])
      } finally {
        await db.db
          .updateTable('actor')
          .set({ deactivatedAt: null })
          .where('did', '=', writer.did)
          .execute()
      }
      await makeNoticesDue()
      await notifications.retryPending()
      expect(syncer.calls).toHaveLength(2)
      expect(await pendingNotices()).toEqual([])
    })

    it('drops a deletion notice once the space is recreated', async () => {
      syncerStatus = 503
      await notifyDeleted()
      await makeNoticesDue()
      const ctx = network.pds.ctx
      await ctx.actorStore.transact(writer.did, (txn) =>
        txn.space.ensureSpace(SpaceRef.parse(deletedSpace)),
      )
      try {
        syncerStatus = 200
        await notifications.retryPending()
        expect(syncer.calls).toHaveLength(1)
        expect(await pendingNotices()).toEqual([])
      } finally {
        await ctx.spacePolicyManager.deleteSpace(SpaceRef.parse(deletedSpace))
      }
    })

    it('keeps a newer retry when an older delivery finishes', async () => {
      syncerStatus = 503
      await notifyDeleted()
      await makeNoticesDue()

      const delivered = createDeferrable()
      const resume = createDeferrable()
      const deliver = notifications['deliverSyncerNotice'].bind(notifications)
      const spy = jest
        .spyOn(notifications as any, 'deliverSyncerNotice')
        .mockImplementationOnce(async (...args: any[]) => {
          await deliver(args[0], args[1])
          delivered.resolve()
          await resume.complete
        })
      syncerStatus = 200
      const inFlight = notifications.retryPending()
      try {
        await delivered.complete
        syncerStatus = 503
        await notifyDeleted()
        const requeued = await pendingNotices()
        expect(requeued).toHaveLength(1)
        resume.resolve()
        await inFlight
        expect(await pendingNotices()).toEqual(requeued)
      } finally {
        resume.resolve()
        await inFlight
        spy.mockRestore()
      }
    })

    it('drops a lapsed registration that rejects its expiry notice', async () => {
      await lapseRegistration()
      syncerStatus = 400
      await notifyExpired()
      expect(await pendingNotices()).toEqual([])
      expect(await getRegistration()).toBeNull()
    })

    it('drops a lapsed registration once its expiry notice stops being retried', async () => {
      await lapseRegistration()
      syncerStatus = 503
      await notifyExpired()
      expect(await getRegistration()).not.toBeNull()
      await db.db
        .updateTable('space_syncer_notification_retry')
        .set({ retryAt: 0, expiresAt: Date.now() })
        .execute()
      await notifications.retryPending()
      expect(await pendingNotices()).toEqual([])
      expect(await getRegistration()).toBeNull()
    })

    it('drops an expiry notice once the registration is renewed', async () => {
      await lapseRegistration()
      syncerStatus = 503
      await notifyExpired()
      await lapseRegistration(Date.now() + HOUR)
      await makeNoticesDue()

      syncerStatus = 200
      await notifications.retryPending()
      expect(syncer.calls).toHaveLength(1)
      expect(await pendingNotices()).toEqual([])
      expect(await getRegistration()).not.toBeNull()
    })

    it('lets a deletion notice supersede a pending expiry notice, but not the reverse', async () => {
      await lapseRegistration()
      syncerStatus = 503
      const ref = SpaceRef.parse(localSpace)
      await notifyExpired()
      await notifications.notifySyncers(
        ref,
        [registration()],
        spaceDeleted.$build({}),
      )
      await notifyExpired()
      const [retry] = await pendingNotices()
      expect(fromJson(retry.noticeJson)).toEqual(spaceDeleted.$build({}))
    })
  })
})

function makeCommit() {
  return { rev: TID.nextStr(), setHash: new LtHash().state() }
}
