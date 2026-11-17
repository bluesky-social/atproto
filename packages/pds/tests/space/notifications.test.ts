import { jest } from '@jest/globals'
import {
  DAY,
  type Deferrable,
  HOUR,
  MINUTE,
  TID,
  createDeferrable,
} from '@atproto/common'
import type { TestNetworkNoAppView } from '@atproto/dev-env'
import { LtHash } from '@atproto/space'
import {
  type RecordKeyString,
  SpaceRef,
  type SpaceRefString,
} from '@atproto/syntax'
import type { AccountDb } from '../../src/account-manager/db/index.js'
import { com } from '../../src/lexicons/index.js'
import {
  SpaceNotifications,
  type SyncerNotice,
} from '../../src/space-notifications.js'
import {
  type Actor,
  MockService,
  type SpaceClient,
  TEST_SPACE_TYPE,
  createSpaceNetwork,
} from '../_space.js'

const { notifyRepoUpdate, notifySpaceUpdate } = com.atproto.space
const { spaceDeleted, registrationExpired } = notifySpaceUpdate

type Schedule = { attempts?: number; retryAt?: number; expiresAt?: number }

/** A mock service's response, which can be held so an older delivery finishes last. */
class Reply {
  status = 200
  error?: string
  private held?: { received: Deferrable; release: Deferrable }

  respond = async () => {
    const held = this.held
    this.held = undefined
    if (held) {
      held.received.resolve()
      await held.release.complete
    }
    const body = this.error ? { error: this.error } : {}
    return { status: this.status, body }
  }

  /** Hold the next response until released; `received` resolves when its request arrives. */
  holdNext() {
    const held = { received: createDeferrable(), release: createDeferrable() }
    this.held = held
    const release = () => held.release.resolve()
    return {
      received: held.received.complete,
      release,
      [Symbol.dispose]: release,
    }
  }

  reset() {
    this.status = 200
    this.error = undefined
    this.held = undefined
  }
}

describe('space notifications', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor
  let dan: Actor
  let bob: Actor
  let db: AccountDb
  let notifications: SpaceNotifications
  let host: MockService
  let remote: SpaceRef
  const hostReply = new Reply()

  beforeAll(async () => {
    ;({ network, sc, alice, dan, bob } = await createSpaceNetwork())
    host = await MockService.create(network, {
      serviceId: 'atproto_pds',
      respond: hostReply.respond,
    })
    remote = new SpaceRef(
      host.did,
      TEST_SPACE_TYPE,
      'remote' as RecordKeyString,
    )
    // An unstarted worker, so retries run only when a test asks.
    const { ctx } = network.pds
    await ctx.spaceNotifications.destroy()
    notifications = ctx.spaceNotifications = new SpaceNotifications(ctx)
    db = ctx.accountManager.db
  })

  beforeEach(async () => {
    hostReply.reset()
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

  const notifyHost = async (commit = makeCommit(), repo = alice.did) => {
    await notifications.notify(remote, repo, commit)
    return commit
  }

  const pending = () =>
    db.db.selectFrom('space_notification_retry').selectAll().execute()

  const updatePending = (set: Schedule) =>
    db.db.updateTable('space_notification_retry').set(set).execute()

  const expireLease = () =>
    db.db
      .updateTable('space_notification_lease')
      .set({ expiresAt: 0 })
      .execute()

  const retryNow = () => sc.retryNotifications(network.pds)

  const deleteAccount = (actor: Actor) =>
    actor.client.call(
      com.atproto.admin.deleteAccount,
      { did: actor.did },
      { headers: actor.pds.adminAuthHeaders() },
    )

  describe('repo updates', () => {
    it('delivers immediately and queues nothing on success', async () => {
      const commit = await notifyHost()
      expect(host.callsTo(notifyRepoUpdate.$lxm)).toMatchObject([
        {
          body: {
            space: remote.toString(),
            repo: alice.did,
            repoRev: commit.rev,
          },
        },
      ])
      expect(await pending()).toEqual([])
    })

    it('queues a failure the space host reports as retryable', async () => {
      // Classified by HTTP status, whatever the error name.
      hostReply.status = 503
      hostReply.error = 'Forbidden'
      const before = Date.now()
      const commit = await notifyHost()
      const [queued] = await pending()
      expect(queued).toMatchObject({
        space: remote.toString(),
        repo: alice.did,
        repoRev: commit.rev,
        attempts: 1,
      })
      expect(queued.expiresAt).toBeGreaterThanOrEqual(before + DAY)
      expect(queued.expiresAt).toBeLessThanOrEqual(Date.now() + DAY)
    })

    it('queues a failure of a local space host to decide', async () => {
      await using app = await MockService.create(network, {
        serviceId: 'atproto_forum',
        respond: () => ({ status: 500, body: { error: 'InternalError' } }),
      })
      const space = await sc.createSpace(alice, {
        policy: com.atproto.managedspace.policy.$build({
          managingApp: app.serviceRef,
        }),
      })
      const commit = makeCommit()
      await notifications.notify(SpaceRef.parse(space), dan.did, commit)
      expect(
        app.callsTo(com.atproto.managedspace.checkAccess.$lxm),
      ).toHaveLength(1)
      expect(await pending()).toMatchObject([
        { space, repo: dan.did, repoRev: commit.rev, attempts: 1 },
      ])
    })

    it('drops a notification the space host rejects', async () => {
      hostReply.status = 403
      await notifyHost()
      expect(host.calls).toHaveLength(1)
      expect(await pending()).toEqual([])
    })

    it.each(['deactivated', 'takendown'] as const)(
      'delivers to a local authority that is %s without a request to itself',
      async (status) => {
        const space = await sc.createSpace(alice, { members: [dan] })
        {
          await using _ = await sc.withStatus(alice, status)
          // Reaching the space host over the network would resolve its DID.
          using _resolve = jest
            .spyOn(network.pds.ctx.idResolver.did, 'resolve')
            .mockRejectedValue(new Error('resolver unavailable'))
          await notifications.notify(
            SpaceRef.parse(space),
            dan.did,
            makeCommit(),
          )
        }
        expect(await pending()).toEqual([])
        expect(await sc.writers(space, alice)).toContain(dan.did)
      },
    )

    it('drops a notification a local space host rejects', async () => {
      const space = await sc.createSpace(alice)
      await notifications.notify(SpaceRef.parse(space), dan.did, makeCommit())
      expect(await pending()).toEqual([])
      expect(await sc.writers(space, alice)).not.toContain(dan.did)
    })

    it('drops queued work when a retry is rejected', async () => {
      hostReply.status = 503
      await notifyHost()
      hostReply.status = 403
      await retryNow()
      expect(host.calls).toHaveLength(2)
      expect(await pending()).toEqual([])
    })

    it.each([200, 403])(
      'clears older queued work when a newer notification ends with %s',
      async (status) => {
        hostReply.status = 503
        await notifyHost()
        hostReply.status = status
        await notifyHost()
        expect(host.calls).toHaveLength(2)
        expect(await pending()).toEqual([])
      },
    )

    it('replaces queued work with a newer revision, resetting its schedule', async () => {
      hostReply.status = 503
      await notifyHost()
      await updatePending({ attempts: 5, expiresAt: Date.now() + HOUR })
      const before = Date.now()
      const newer = await notifyHost()
      const [queued] = await pending()
      expect(queued).toMatchObject({ repoRev: newer.rev, attempts: 1 })
      expect(new Uint8Array(queued.data)).toEqual(
        new LtHash(newer.setHash).digest(),
      )
      expect(queued.expiresAt).toBeGreaterThanOrEqual(before + DAY)
    })

    it('ignores an older or equal revision', async () => {
      hostReply.status = 503
      const older = makeCommit()
      const newer = await notifyHost()
      const queued = await pending()
      await notifyHost(older)
      await notifyHost(newer)
      expect(await pending()).toEqual(queued)
    })

    it('keeps newer queued work when an older notification succeeds', async () => {
      const older = makeCommit()
      const newer = makeCommit()
      using held = hostReply.holdNext()
      const inFlight = notifyHost(older)
      await held.received
      hostReply.status = 503
      await notifyHost(newer)
      hostReply.status = 200
      held.release()
      await inFlight
      expect(await pending()).toMatchObject([{ repoRev: newer.rev }])
    })

    it.each([200, 503])(
      'keeps newer queued work when an older retry finishes with %s',
      async (status) => {
        // With the clock stopped, the newer work has the older's attempts and
        // deadline, so only its revision tells them apart.
        using _now = jest.spyOn(Date, 'now').mockReturnValue(Date.now())
        hostReply.status = 503
        await notifyHost()
        await updatePending({ retryAt: 0 })
        using held = hostReply.holdNext()
        const inFlight = notifications.retryPending()
        await held.received
        await notifyHost()
        const fresh = await pending()
        hostReply.status = status
        held.release()
        await inFlight
        expect(await pending()).toEqual(fresh)
      },
    )

    it('throws when a failed delivery cannot be queued', async () => {
      hostReply.status = 503
      using _ = jest
        .spyOn(db, 'executeWithRetry')
        .mockRejectedValueOnce(new Error('database unavailable'))
      await expect(notifyHost()).rejects.toThrow('database unavailable')
      expect(host.calls).toHaveLength(1)
    })
  })

  describe('retry worker', () => {
    it('retries only due work', async () => {
      hostReply.status = 503
      await notifyHost()
      await notifications.retryPending()
      expect(host.calls).toHaveLength(1)
      await retryNow()
      expect(host.calls).toHaveLength(2)
      expect(await pending()).toMatchObject([{ attempts: 2 }])
    })

    it('doubles the delay up to an hour', async () => {
      hostReply.status = 503
      let before = Date.now()
      await notifyHost()
      expectDelay((await pending())[0].retryAt, before, MINUTE)

      before = Date.now()
      await retryNow()
      expectDelay((await pending())[0].retryAt, before, 2 * MINUTE)

      await updatePending({ attempts: 20 })
      before = Date.now()
      await retryNow()
      expectDelay((await pending())[0].retryAt, before, HOUR)
    })

    it('caps the last retry at the deadline, then drops it', async () => {
      hostReply.status = 503
      await notifyHost()
      const expiresAt = Date.now() + MINUTE / 2
      await updatePending({ retryAt: 0, expiresAt })
      await notifications.retryPending()
      expect(await pending()).toMatchObject([{ retryAt: expiresAt }])

      using _now = jest.spyOn(Date, 'now').mockReturnValue(expiresAt)
      await notifications.retryPending()
      expect(host.calls).toHaveLength(2)
      expect(await pending()).toEqual([])
    })

    it('defers retries while the writer is inactive', async () => {
      hostReply.status = 503
      await notifyHost()
      hostReply.status = 200
      {
        await using _ = await sc.withStatus(alice, 'deactivated')
        await retryNow()
        expect(host.calls).toHaveLength(1)
        expect(await pending()).toMatchObject([{ attempts: 2 }])
      }
      await retryNow()
      expect(host.calls).toHaveLength(2)
      expect(await pending()).toEqual([])
    })

    it('drops work for a writer account that is gone', async () => {
      const writer = await sc.createActor('gone-writer')
      hostReply.status = 503
      await notifyHost(makeCommit(), writer.did)
      await deleteAccount(writer)
      hostReply.status = 200
      await retryNow()
      expect(host.calls).toHaveLength(1)
      expect(await pending()).toEqual([])
    })

    it('runs in one process at a time, and another takes over when the lease expires', async () => {
      await using first = new SpaceNotifications(network.pds.ctx)
      await using second = new SpaceNotifications(network.pds.ctx)
      await first.retryPending()
      hostReply.status = 503
      await notifyHost()
      await updatePending({ retryAt: 0 })
      hostReply.status = 200

      await second.retryPending()
      expect(host.calls).toHaveLength(1)
      await expireLease()
      await second.retryPending()
      expect(host.calls).toHaveLength(2)
      expect(await pending()).toEqual([])
    })

    it('releases only its own lease on destroy', async () => {
      await using first = new SpaceNotifications(network.pds.ctx)
      await using second = new SpaceNotifications(network.pds.ctx)
      await using third = new SpaceNotifications(network.pds.ctx)
      await first.retryPending()
      await expireLease()
      await second.retryPending()
      hostReply.status = 503
      await notifyHost()
      await updatePending({ retryAt: 0 })
      hostReply.status = 200

      await first.destroy()
      await third.retryPending()
      expect(host.calls).toHaveLength(1)
      await second.destroy()
      await third.retryPending()
      expect(host.calls).toHaveLength(2)
    })

    it('delivers the latest state to the authority after a restart', async () => {
      const space = await sc.createSpace(alice, { members: [bob] })
      const { ctx } = bob.pds
      {
        using _ = jest
          .spyOn(ctx.idResolver.did, 'resolve')
          .mockRejectedValue(new Error('resolver unavailable'))
        await sc.write(bob, space)
        await sc.write(bob, space)
      }
      const commit = (await sc.latestCommit(bob, space))!
      const queued = () =>
        ctx.accountManager.db.db
          .selectFrom('space_notification_retry')
          .selectAll()
          .execute()
      expect(await queued()).toMatchObject([
        { space, repo: bob.did, repoRev: commit.rev },
      ])

      await ctx.spaceNotifications.destroy()
      await ctx.accountManager.db.db
        .updateTable('space_notification_retry')
        .set({ retryAt: 0 })
        .execute()
      ctx.spaceNotifications = new SpaceNotifications(ctx)
      ctx.spaceNotifications.start()
      await ctx.spaceNotifications.retryPending()

      expect(await queued()).toEqual([])
      const cred = await sc.credentialFor(bob, space)
      const { repos } = await cred
        .clientFor(alice.pds)
        .call(com.atproto.space.listWriters, { space })
      expect(repos).toMatchObject([
        {
          $type: com.atproto.space.defs.repoWrite.$type,
          repo: bob.did,
          repoRev: commit.rev,
          data: commit.data,
        },
      ])
    })
  })

  describe('syncer notices', () => {
    const deleted = spaceDeleted.$build({})
    const expired = registrationExpired.$build({ spaceRev: TID.nextStr() })
    const syncerReply = new Reply()
    let syncer: MockService

    beforeAll(async () => {
      syncer = await MockService.create(network, {
        serviceId: 'atproto_space_syncer',
        respond: syncerReply.respond,
      })
    })

    beforeEach(() => {
      syncerReply.reset()
      syncer.calls.length = 0
    })

    afterAll(async () => {
      await syncer?.close()
    })

    const send = (space: SpaceRefString, notice: SyncerNotice) =>
      notifications.notifySyncers(
        SpaceRef.parse(space),
        [syncer.notifyRegistration()],
        notice,
      )

    const pendingNotices = () =>
      db.db.selectFrom('space_syncer_notification_retry').selectAll().execute()

    const updateNotices = (set: Schedule) =>
      db.db.updateTable('space_syncer_notification_retry').set(set).execute()

    const register = (space: SpaceRefString) =>
      sc.credentialFor(alice, space, { notify: syncer.notifyRegistration() })

    // No endpoint exposes registrations.
    const isRegistered = async (space: SpaceRefString) => {
      const registration = await network.pds.ctx.actorStore.read(
        alice.did,
        (store) =>
          store.space.getNotifyRegistration(space, syncer.notifyRegistration()),
      )
      return registration !== null
    }

    const deletedSpace = async (authority = alice) => {
      const space = await sc.createSpace(authority)
      await authority.client.call(
        com.atproto.space.deleteSpace,
        { space },
        { headers: authority.headers },
      )
      return space
    }

    const lapsedSpace = async () => {
      const space = await sc.createSpace(alice)
      await register(space)
      await sc.lapseRegistration(space, syncer.url)
      return space
    }

    // A space and a notice it is owed.
    const owedNotice = async (kind: 'deletion' | 'expiry') =>
      kind === 'deletion'
        ? { space: await deletedSpace(), notice: deleted }
        : { space: await lapsedSpace(), notice: expired }

    it('queues nothing on success', async () => {
      const space = await deletedSpace()
      await send(space, deleted)
      expect(syncer.spaceUpdates()).toEqual([deleted])
      expect(await pendingNotices()).toEqual([])
    })

    it.each(['deletion', 'expiry'] as const)(
      'retries a transient failure of a %s notice for 72 hours',
      async (kind) => {
        const { space, notice } = await owedNotice(kind)
        syncerReply.status = 503
        const before = Date.now()
        await send(space, notice)
        const [queued] = await pendingNotices()
        expect(queued).toMatchObject({
          space,
          endpoint: syncer.url,
          attempts: 1,
        })
        expect(queued.expiresAt).toBeGreaterThanOrEqual(before + 72 * HOUR)
        expect(queued.expiresAt).toBeLessThanOrEqual(Date.now() + 72 * HOUR)

        syncerReply.status = 200
        await retryNow()
        expect(syncer.spaceUpdates()).toEqual([notice, notice])
        expect(await pendingNotices()).toEqual([])
      },
    )

    it('drops a permanent failure', async () => {
      const space = await deletedSpace()
      syncerReply.status = 400
      await send(space, deleted)
      expect(syncer.spaceUpdates()).toHaveLength(1)
      expect(await pendingNotices()).toEqual([])
    })

    it('backs off from a minute, capped at twelve hours', async () => {
      const space = await deletedSpace()
      syncerReply.status = 503
      let before = Date.now()
      await send(space, deleted)
      expectDelay((await pendingNotices())[0].retryAt, before, MINUTE)

      await updateNotices({ attempts: 10, retryAt: 0 })
      before = Date.now()
      await notifications.retryPending()
      expectDelay((await pendingNotices())[0].retryAt, before, 12 * HOUR)
    })

    it('makes a final attempt past the window, then drops it', async () => {
      const space = await deletedSpace()
      syncerReply.status = 503
      await send(space, deleted)
      await updateNotices({ retryAt: 0, expiresAt: Date.now() })
      await notifications.retryPending()
      expect(syncer.spaceUpdates()).toHaveLength(2)
      expect(await pendingNotices()).toEqual([])
    })

    it('defers notices while the authority is inactive', async () => {
      const space = await deletedSpace()
      syncerReply.status = 503
      await send(space, deleted)
      syncerReply.status = 200
      {
        await using _ = await sc.withStatus(alice, 'deactivated')
        await retryNow()
        expect(syncer.spaceUpdates()).toHaveLength(1)
        expect(await pendingNotices()).toMatchObject([{ attempts: 2 }])
      }
      await retryNow()
      expect(syncer.spaceUpdates()).toEqual([deleted, deleted])
      expect(await pendingNotices()).toEqual([])
    })

    it('drops notices for an authority account that is gone', async () => {
      const authority = await sc.createActor('gone-authority')
      const space = await deletedSpace(authority)
      syncerReply.status = 503
      await send(space, deleted)
      await deleteAccount(authority)
      syncerReply.status = 200
      await retryNow()
      expect(syncer.spaceUpdates()).toHaveLength(1)
      expect(await pendingNotices()).toEqual([])
    })

    it('drops a deletion notice once the space is recreated', async () => {
      const space = await deletedSpace()
      syncerReply.status = 503
      await send(space, deleted)
      await sc.createSpace(alice, { skey: SpaceRef.parse(space).skey })
      syncerReply.status = 200
      await retryNow()
      expect(syncer.spaceUpdates()).toHaveLength(1)
      expect(await pendingNotices()).toEqual([])
    })

    it('keeps a newer notice when an older delivery finishes', async () => {
      const space = await deletedSpace()
      syncerReply.status = 503
      await send(space, deleted)
      using held = syncerReply.holdNext()
      const inFlight = retryNow()
      await held.received
      await send(space, deleted)
      const requeued = await pendingNotices()
      syncerReply.status = 200
      held.release()
      await inFlight
      expect(await pendingNotices()).toEqual(requeued)
    })

    it('unregisters a lapsed registration whose expiry notice is never delivered', async () => {
      const space = await lapsedSpace()
      syncerReply.status = 503
      await send(space, expired)
      expect(await isRegistered(space)).toBe(true)
      await updateNotices({ retryAt: 0, expiresAt: Date.now() })
      await notifications.retryPending()
      expect(await pendingNotices()).toEqual([])
      expect(await isRegistered(space)).toBe(false)
    })

    it('drops an expiry notice once the registration is renewed', async () => {
      const space = await lapsedSpace()
      syncerReply.status = 503
      await send(space, expired)
      await register(space)
      syncerReply.status = 200
      await retryNow()
      expect(syncer.spaceUpdates()).toHaveLength(1)
      expect(await pendingNotices()).toEqual([])
    })

    it('lets a deletion notice supersede a pending expiry notice, but not the reverse', async () => {
      // An expiry notice for a deleted space is no longer owed, so only a
      // pending deletion notice is delivered on retry.
      const space = await deletedSpace()
      syncerReply.status = 503
      await send(space, expired)
      await send(space, deleted)
      await send(space, expired)
      syncerReply.status = 200
      await retryNow()
      expect(syncer.spaceUpdates()).toEqual([
        expired,
        deleted,
        expired,
        deleted,
      ])
    })
  })
})

function makeCommit() {
  const rev = TID.nextStr()
  return { rev, setHash: new LtHash().add(rev).state() }
}

// Retries are jittered to between half and all of their delay.
function expectDelay(retryAt: number, before: number, delay: number) {
  expect(retryAt).toBeGreaterThanOrEqual(before + delay / 2)
  expect(retryAt).toBeLessThanOrEqual(Date.now() + delay)
}
