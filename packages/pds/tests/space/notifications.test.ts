import { jest } from '@jest/globals'
import { DAY, HOUR, MINUTE, TID, createDeferrable } from '@atproto/common'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { type SpaceRefString, currentDatetimeString } from '@atproto/lex'
import { LtHash } from '@atproto/space'
import { XRPCError } from '@atproto/xrpc-server'
import type { AccountDb } from '../../src/account-manager/db/index.js'
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
      serviceId: 'atproto_space_host',
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
    await notifications.notify(space, writer.did, commit)
    expect(host.callsTo(com.atproto.space.notifyWrite.$lxm)).toHaveLength(1)
    expect(host.calls[0].body).toMatchObject({ repoRev: commit.rev })
    expect(
      await db.db.selectFrom('space_notification_retry').selectAll().execute(),
    ).toEqual([])
  })

  it('clears an older queued notification when a new write succeeds immediately', async () => {
    status = 503
    const older = makeCommit()
    await notifications.notify(space, writer.did, older)
    expect((await pending()).repoRev).toBe(older.rev)

    status = 200
    await notifications.notify(space, writer.did, makeCommit())
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
      await notifications.notify(space, writer.did, commit)
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
    await notifications.notify(space, writer.did, makeCommit())
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
      await notifications.notify(space, writer.did, makeCommit())
      expect(
        await db.db
          .selectFrom('space_notification_retry')
          .selectAll()
          .execute(),
      ).toEqual([])

      status = 503
      await notifications.notify(space, writer.did, makeCommit())
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
    await notifications.notify(localSpace, writer.did, makeCommit())
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
      await notifications.notify(space, writer.did, makeCommit())
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
        await notifications.notify(space, writer.did, makeCommit())
        await makeDue()
        status = code
        error = reason
        if (attempt === 'notify') {
          await notifications.notify(space, writer.did, makeCommit())
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
      await notifications.notify(target, outsider.did, makeCommit())
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
        await notifications.notify(target, outsider.did, makeCommit())
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
    await notifications.notify(space, writer.did, commit)
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
      notifications.notify(space, writer.did, makeCommit()),
    ).rejects.toThrow('database unavailable')
    expect(host.calls).toHaveLength(1)
  })

  it('starts a fresh retry flow for a newer revision and ignores older or equal revisions', async () => {
    status = 503
    const older = makeCommit()
    const newer = makeCommit()
    newer.setHash[0] = 1
    await notifications.notify(space, writer.did, older)
    const retryAt = Date.now() + HOUR
    const expiresAt = Date.now() + DAY / 2
    await db.db
      .updateTable('space_notification_retry')
      .set({ attempts: 5, retryAt, expiresAt })
      .execute()
    const before = Date.now()
    await notifications.notify(space, writer.did, newer)
    const retry = await pending()
    expect(retry).toMatchObject({
      repoRev: newer.rev,
      attempts: 1,
    })
    expect(retry.retryAt).toBeGreaterThanOrEqual(before + MINUTE / 2)
    expect(retry.retryAt).toBeLessThanOrEqual(Date.now() + MINUTE)
    expect(retry.expiresAt).toBeGreaterThanOrEqual(before + DAY)
    expect(retry.expiresAt).toBeLessThanOrEqual(Date.now() + DAY)
    expect(new Uint8Array(retry.hash)).toEqual(
      new LtHash(newer.setHash).digest(),
    )
    await notifications.notify(space, writer.did, older)
    await notifications.notify(space, writer.did, newer)
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
      const inFlight = notifications.notify(space, writer.did, older)
      try {
        await started.complete
        status = 503
        await notifications.notify(space, writer.did, newer)
        status = code
        error = reason
        resume.resolve()
        await inFlight
        expect((await pending()).repoRev).toBe(newer.rev)
        await notifications.notify(space, writer.did, newer)
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
    await notifications.notify(space, writer.did, makeCommit())
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
      await notifications.notify(space, writer.did, makeCommit())
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
        await notifications.notify(space, writer.did, newer)
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
    await notifications.notify(space, writer.did, makeCommit())
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
    await notifications.notify(space, writer.did, newer)
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
    await notifications.notify(space, writer.did, makeCommit())
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
    await notifications.notify(space, writer.did, makeCommit())
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
})

function makeCommit() {
  return { rev: TID.nextStr(), setHash: new LtHash().state() }
}
