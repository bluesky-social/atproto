import { randomUUID } from 'node:crypto'
import { DAY, HOUR, MINUTE, SECOND, allFulfilled } from '@atproto/common'
import {
  RETRYABLE_HTTP_STATUS_CODES,
  XrpcError,
  type l,
  xrpc,
} from '@atproto/lex'
import { LtHash, spaceHostAud } from '@atproto/space'
import { type DidString, SpaceRef, type SpaceRefString } from '@atproto/syntax'
import { XRPCError } from '@atproto/xrpc-server'
import type {
  SpaceNotificationRetry,
  SpaceSyncerNotificationRetry,
} from './account-manager/db/index.js'
import {
  processNotifyRepoUpdate,
  resolveNotifyTarget,
} from './api/com/atproto/space/util.js'
import type { AppContext } from './context.js'
import { fromJson, toJson } from './db/index.js'
import { com } from './lexicons/index.js'
import { spaceLogger } from './logger.js'

const { spaceDeleted, registrationExpired } =
  com.atproto.space.notifySpaceUpdate

/** An update that the space host must reliably deliver to a registered syncer. */
export type SyncerNotice =
  | l.$Typed<com.atproto.space.notifySpaceUpdate.SpaceDeleted>
  | l.$Typed<com.atproto.space.notifySpaceUpdate.RegistrationExpired>

type SyncerRecipient = {
  space: SpaceRefString
  endpoint: string
  token: string
}

// A syncer notice is retried after each of these delays in turn, repeating the
// last, until a retry fails after the retry window has closed.
const SYNCER_NOTICE_RETRY_DELAYS = [
  MINUTE,
  10 * MINUTE,
  HOUR,
  6 * HOUR,
  12 * HOUR,
]
const SYNCER_NOTICE_RETRY_WINDOW = 72 * HOUR

/**
 * Sends notifications immediately; retryable failures are coalesced in the
 * account-manager DB. Each newer revision resets the backoff and 24-hour window.
 * An expiring lease selects one retry worker across processes, allowing takeover
 * if that worker stops.
 *
 * Notices to syncers, of a space's deletion or a registration's expiry, are
 * retried the same way, but on a slower schedule and for at least 72 hours.
 */
export class SpaceNotifications implements AsyncDisposable {
  private readonly owner = randomUUID()
  private timer?: NodeJS.Timeout
  private running?: Promise<void>
  private abortController = new AbortController()

  constructor(private readonly ctx: AppContext) {}

  private get db() {
    return this.ctx.accountManager.db
  }

  start(): void {
    if (this.timer || this.abortController.signal.aborted) return
    this.timer = setInterval(() => void this.retryPending(), 10 * SECOND)
    this.timer.unref()
    void this.retryPending()
  }

  /** Send immediately, persisting retryable failures for the retry worker. */
  async notify(
    ref: SpaceRef,
    repo: DidString,
    commit: { rev: string; setHash: Uint8Array },
  ): Promise<void> {
    const space = ref.toString()
    const update = {
      space,
      repo,
      repoRev: commit.rev,
      data: new LtHash(commit.setHash).digest(),
    }
    try {
      await this.deliver(ref, update)
      await this.clearRetry(update)
    } catch (err) {
      if (!isRetryableError(err)) {
        await this.clearRetry(update)
        spaceLogger.warn(
          { err, space, repo },
          'space notification will not be retried',
        )
        return
      }
      const schedule = {
        attempts: 1,
        retryAt: nextRetryAt(1),
        expiresAt: Date.now() + DAY,
      }
      await this.db.executeWithRetry(
        this.db.db
          .insertInto('space_notification_retry')
          .values({ ...update, ...schedule })
          .onConflict((oc) =>
            oc
              .columns(['repo', 'space'])
              .doUpdateSet({
                repoRev: update.repoRev,
                data: update.data,
                ...schedule,
              })
              .where('space_notification_retry.repoRev', '<', update.repoRev),
          ),
      )
      spaceLogger.warn(
        { err, space, repo },
        'space notification queued for retry',
      )
    }
  }

  /**
   * Send a notice to each of the given syncers, persisting retryable failures.
   * If a syncer rejects its expiry notice, or can't be reached within the retry
   * window, its registration is dropped.
   */
  async notifySyncers(
    ref: SpaceRef,
    registrations: { endpoint: string; token: string }[],
    notice: SyncerNotice,
  ): Promise<void> {
    const space = ref.toString()
    await allFulfilled(
      registrations.map(async ({ endpoint, token }) => {
        const recipient = { space, endpoint, token }
        try {
          await this.deliverSyncerNotice(recipient, notice)
        } catch (err) {
          if (!isRetryableError(err)) {
            await this.abandonSyncerNotice(recipient, notice)
            spaceLogger.warn(
              { err, space, endpoint },
              'syncer notification will not be retried',
            )
            return
          }
          await this.queueSyncerNotice(recipient, notice)
          spaceLogger.warn(
            { err, space, endpoint },
            'syncer notification queued for retry',
          )
        }
      }),
    )
  }

  private async queueSyncerNotice(
    recipient: SyncerRecipient,
    notice: SyncerNotice,
  ): Promise<void> {
    const noticeJson = toJson(notice)
    const schedule = {
      attempts: 1,
      retryAt: nextSyncerRetryAt(1),
      expiresAt: Date.now() + SYNCER_NOTICE_RETRY_WINDOW,
    }
    await this.db.executeWithRetry(
      this.db.db
        .insertInto('space_syncer_notification_retry')
        .values({ ...recipient, noticeJson, ...schedule })
        .onConflict((oc) => {
          // A deletion notice replaces whatever is pending. An expiry notice
          // never replaces a pending notice, so a deletion notice is never lost.
          const pending = oc.columns(['space', 'endpoint', 'token'])
          return spaceDeleted.$isTypeOf(notice)
            ? pending.doUpdateSet({ noticeJson, ...schedule })
            : pending.doNothing()
        }),
    )
  }

  /** Drain due retries while this process holds the worker lease. */
  retryPending(): Promise<void> {
    if (this.abortController.signal.aborted) return Promise.resolve()
    return (this.running ??= this.retry()
      .catch((err) =>
        spaceLogger.warn({ err }, 'space notification retries failed'),
      )
      .finally(() => {
        this.running = undefined
      }))
  }

  private async retry(): Promise<void> {
    while (!this.abortController.signal.aborted) {
      const now = Date.now()
      const expiresAt = now + MINUTE
      const [lease] = await this.db.executeWithRetry(
        this.db.db
          .updateTable('space_notification_lease')
          .set({ owner: this.owner, expiresAt })
          .where('id', '=', 1)
          .where((eb) =>
            eb.or([eb('owner', '=', this.owner), eb('expiresAt', '<=', now)]),
          ),
      )
      if (lease.numUpdatedRows === 0n) return

      const retries = await this.db.db
        .selectFrom('space_notification_retry')
        .leftJoin('actor', 'actor.did', 'space_notification_retry.repo')
        .selectAll('space_notification_retry')
        .select(['actor.did as accountDid', 'deactivatedAt', 'takedownRef'])
        .where('retryAt', '<=', now)
        .orderBy('retryAt')
        .limit(5)
        .execute()
      const syncerRetries = await this.db.db
        .selectFrom('space_syncer_notification_retry')
        .selectAll()
        .where('retryAt', '<=', now)
        .orderBy('retryAt')
        .limit(5)
        .execute()
      if (!retries.length && !syncerRetries.length) return
      if (this.abortController.signal.aborted || Date.now() >= expiresAt) return

      // @NOTE Renew between batches; lease expiry can cause duplicate delivery.
      await allFulfilled([
        ...retries.map(async (retry) => {
          if (retry.expiresAt <= Date.now()) {
            await this.expireRetry(retry)
          } else if (!retry.accountDid) {
            await this.clearRetry(retry)
          } else if (retry.deactivatedAt || retry.takedownRef) {
            await this.reschedule(retry)
          } else {
            await this.retryOne(retry)
          }
        }),
        ...syncerRetries.map((retry) => this.retrySyncerNotice(retry)),
      ])
    }
  }

  private async retrySyncerNotice(
    retry: SpaceSyncerNotificationRetry,
  ): Promise<void> {
    const { space, endpoint } = retry
    const notice = fromJson(retry.noticeJson)

    const { spaceDid } = SpaceRef.parse(space)
    const authority = await this.ctx.accountManager.getAccount(spaceDid, {
      includeDeactivated: true,
      includeTakenDown: true,
    })
    if (!authority) {
      // Deleting the authority's account deleted its spaces with it, which
      // syncers learn from the account event.
      await this.clearSyncerRetry(retry)
      return
    }
    if (authority.deactivatedAt || authority.takedownRef) {
      await this.rescheduleSyncerRetry(retry, notice)
      return
    }
    if (!(await this.isSyncerNoticeOwed(retry, notice))) {
      await this.clearSyncerRetry(retry)
      return
    }

    try {
      await this.deliverSyncerNotice(retry, notice)
      await this.clearSyncerRetry(retry)
    } catch (err) {
      if (!isRetryableError(err)) {
        await this.clearSyncerRetry(retry)
        await this.abandonSyncerNotice(retry, notice)
        spaceLogger.warn(
          { err, space, endpoint },
          'syncer notification will not be retried',
        )
        return
      }
      await this.rescheduleSyncerRetry(retry, notice)
      spaceLogger.warn(
        { err, space, endpoint },
        'syncer notification retry failed',
      )
    }
  }

  // A notice that no longer applies is dropped rather than sent.
  private async isSyncerNoticeOwed(
    recipient: SyncerRecipient,
    notice: SyncerNotice,
  ): Promise<boolean> {
    const { space } = recipient
    const { spaceDid } = SpaceRef.parse(space)
    return this.ctx.actorStore.read(spaceDid, async (store) => {
      if (registrationExpired.$isTypeOf(notice)) {
        // Not owed if the syncer has renewed since.
        const registration = await store.space.getNotifyRegistration(
          space,
          recipient,
        )
        return (
          registration !== null &&
          registration.expiresAt <= new Date().toISOString()
        )
      }
      // Not owed if the space has been recreated since.
      const current = await store.space.getSpace(space)
      return !!current?.deletedAt
    })
  }

  /**
   * Give up on delivering a notice. A syncer that rejects its expiry notice, or
   * can't be reached, is unregistered, unless it has renewed since. A deleted
   * space's registrations were already dropped with it.
   */
  private async abandonSyncerNotice(
    recipient: SyncerRecipient,
    notice: SyncerNotice,
  ): Promise<void> {
    if (!registrationExpired.$isTypeOf(notice)) return
    const { space } = recipient
    const { spaceDid } = SpaceRef.parse(space)
    await this.ctx.actorStore.transact(spaceDid, (actorTxn) =>
      actorTxn.space.removeLapsedNotifyRegistration(
        space,
        recipient,
        new Date().toISOString(),
      ),
    )
  }

  // Retries aren't scheduled to stop at the end of the window, so the last one
  // lands after it. Once that one has failed too, the notice is abandoned.
  private async rescheduleSyncerRetry(
    retry: SpaceSyncerNotificationRetry,
    notice: SyncerNotice,
  ): Promise<void> {
    if (retry.expiresAt <= Date.now()) {
      await this.clearSyncerRetry(retry)
      await this.abandonSyncerNotice(retry, notice)
      spaceLogger.warn(
        { space: retry.space, endpoint: retry.endpoint },
        'syncer notification expired after 72 hours',
      )
      return
    }
    const attempts = retry.attempts + 1
    await this.db.executeWithRetry(
      this.db.db
        .updateTable('space_syncer_notification_retry')
        .set({ attempts, retryAt: nextSyncerRetryAt(attempts) })
        .where('space', '=', retry.space)
        .where('endpoint', '=', retry.endpoint)
        .where('token', '=', retry.token)
        .where('retryAt', '=', retry.retryAt),
    )
  }

  // @NOTE Matching retryAt leaves alone a row re-queued since.
  private async clearSyncerRetry(
    retry: Pick<
      SpaceSyncerNotificationRetry,
      'space' | 'endpoint' | 'token' | 'retryAt'
    >,
  ): Promise<void> {
    await this.db.executeWithRetry(
      this.db.db
        .deleteFrom('space_syncer_notification_retry')
        .where('space', '=', retry.space)
        .where('endpoint', '=', retry.endpoint)
        .where('token', '=', retry.token)
        .where('retryAt', '=', retry.retryAt),
    )
  }

  private async retryOne(retry: SpaceNotificationRetry): Promise<void> {
    const { space, repo } = retry
    try {
      await this.deliver(SpaceRef.parse(space), retry)
      await this.clearRetry(retry)
    } catch (err) {
      if (!isRetryableError(err)) {
        await this.clearRetry(retry)
        spaceLogger.warn(
          { err, space, repo },
          'space notification will not be retried',
        )
        return
      }
      await this.reschedule(retry)
      spaceLogger.warn({ err, space, repo }, 'space notification retry failed')
    }
  }

  private async reschedule(retry: SpaceNotificationRetry): Promise<void> {
    const attempts = retry.attempts + 1
    await this.db.executeWithRetry(
      this.db.db
        .updateTable('space_notification_retry')
        .set({
          attempts,
          retryAt: Math.min(nextRetryAt(attempts), retry.expiresAt),
        })
        .where('repo', '=', retry.repo)
        .where('space', '=', retry.space)
        .where('repoRev', '=', retry.repoRev)
        .where('attempts', '=', retry.attempts)
        .where('expiresAt', '=', retry.expiresAt),
    )
  }

  private async expireRetry(retry: SpaceNotificationRetry): Promise<void> {
    const { repo, space } = retry
    const [result] = await this.db.executeWithRetry(
      this.db.db
        .deleteFrom('space_notification_retry')
        .where('repo', '=', repo)
        .where('space', '=', space)
        .where('expiresAt', '<=', Date.now()),
    )
    if (result.numDeletedRows > 0n) {
      spaceLogger.warn(
        { repo, space },
        'space notification expired after 24 hours',
      )
    }
  }

  private async clearRetry(
    delivered: Pick<SpaceNotificationRetry, 'repo' | 'space' | 'repoRev'>,
  ): Promise<void> {
    await this.db.executeWithRetry(
      this.db.db
        .deleteFrom('space_notification_retry')
        .where('repo', '=', delivered.repo)
        .where('space', '=', delivered.space)
        .where('repoRev', '<=', delivered.repoRev),
    )
  }

  private async deliver(
    ref: SpaceRef,
    update: Pick<SpaceNotificationRetry, 'space' | 'repo' | 'repoRev' | 'data'>,
  ): Promise<void> {
    const signal = AbortSignal.any([
      this.abortController.signal,
      AbortSignal.timeout(10 * SECOND),
    ])
    signal.throwIfAborted()
    const body = {
      space: update.space,
      repo: update.repo,
      repoRev: update.repoRev,
      data: update.data,
    }
    const { spaceDid } = ref
    const authority = await this.ctx.accountManager.getAccount(spaceDid)
    if (authority) {
      await processNotifyRepoUpdate(this.ctx, ref, body)
    } else {
      const target = await resolveNotifyTarget(this.ctx, {
        iss: body.repo,
        service: spaceHostAud(spaceDid),
        lxm: com.atproto.space.notifyRepoUpdate.$lxm,
      })
      if (!target) throw new Error('Could not resolve space host')
      await xrpc(
        { service: target.endpoint, fetch: this.ctx.safeFetch },
        com.atproto.space.notifyRepoUpdate,
        {
          headers: target.headers,
          body,
          signal,
        },
      )
    }
  }

  private async deliverSyncerNotice(
    recipient: SyncerRecipient,
    notice: SyncerNotice,
  ): Promise<void> {
    const signal = AbortSignal.any([
      this.abortController.signal,
      AbortSignal.timeout(10 * SECOND),
    ])
    signal.throwIfAborted()
    // The endpoint is chosen by the syncer, so it's fetched as untrusted.
    await xrpc(
      { service: recipient.endpoint, fetch: this.ctx.safeFetch },
      com.atproto.space.notifySpaceUpdate,
      {
        body: {
          space: recipient.space,
          token: recipient.token,
          update: notice,
        },
        signal,
      },
    )
  }

  async destroy(): Promise<void> {
    if (this.abortController.signal.aborted) return
    clearInterval(this.timer)
    this.abortController.abort()
    await this.running
    await this.db
      .executeWithRetry(
        this.db.db
          .updateTable('space_notification_lease')
          .set({ expiresAt: 0 })
          .where('id', '=', 1)
          .where('owner', '=', this.owner),
      )
      .catch((err) =>
        spaceLogger.warn({ err }, 'space notification lease release failed'),
      )
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy()
  }
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof XrpcError) return err.shouldRetry()
  if (err instanceof XRPCError) {
    return RETRYABLE_HTTP_STATUS_CODES.has(err.statusCode)
  }
  // @NOTE Resolution and local storage failures can precede an XRPC request.
  return true
}

function nextRetryAt(attempts: number): number {
  // @NOTE Double the base delay from one minute up to one hour.
  const delay = Math.min(MINUTE * 2 ** Math.min(attempts - 1, 6), HOUR)
  return retryAfter(delay)
}

function nextSyncerRetryAt(attempts: number): number {
  const delays = SYNCER_NOTICE_RETRY_DELAYS
  return retryAfter(delays[Math.min(attempts, delays.length) - 1])
}

function retryAfter(delay: number): number {
  // @NOTE Jitter of 50-100%
  return Date.now() + Math.floor(delay * (0.5 + Math.random() / 2))
}
