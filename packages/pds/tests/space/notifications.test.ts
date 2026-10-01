import { jest } from '@jest/globals'
import { DAY, HOUR, MINUTE, TID, createDeferrable } from '@atproto/common'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { type SpaceRefString, currentDatetimeString } from '@atproto/lex'
import { LtHash } from '@atproto/space'
import type { AccountDb } from '../../src/account-manager/db/index.js'
import { com } from '../../src/lexicons/index.js'
import { SpaceNotifications } from '../../src/space-notifications.js'
import { type Actor, MockService, SpaceClient } from '../_space.js'

describe('space notification retries', () => {
  let network: TestNetworkNoAppView
  let writer: Actor
  let host: MockService
  let space: SpaceRefString
  let notifications: SpaceNotifications
  let db: AccountDb
  let status = 200

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'space_notification_retries',
    })
    const sc = new SpaceClient(network)
    writer = await sc.createActor('writer', network.pds)
    host = await MockService.create(network, {
      serviceId: 'atproto_space_host',
      respond: () => ({ status, body: {} }),
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

  it.each([400, 503])(
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
    },
  )

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

  it('coalesces failures without resetting backoff or expiration', async () => {
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
    await notifications.notify(space, writer.did, newer)
    await notifications.notify(space, writer.did, older)
    const retry = await pending()
    expect(retry).toMatchObject({
      repoRev: newer.rev,
      attempts: 5,
      retryAt,
      expiresAt,
    })
    expect(new Uint8Array(retry.hash)).toEqual(
      new LtHash(newer.setHash).digest(),
    )
  })

  it('keeps newer queued work when an older delivery finishes', async () => {
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
      status = 200
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
  })

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

  it('retains backoff when a newer write fails during a retry', async () => {
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
      resume.resolve()
      await inFlight
      expect(await pending()).toMatchObject({ repoRev: newer.rev, attempts: 2 })
      expect((await pending()).retryAt).toBeGreaterThan(Date.now())
      expect(host.calls).toHaveLength(3)
    } finally {
      resume.resolve()
      await inFlight
    }
  })

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
