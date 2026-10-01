import { randomUUID } from 'node:crypto'
import { DAY, HOUR, MINUTE, SECOND, allFulfilled } from '@atproto/common'
import {
  type DidString,
  RETRYABLE_HTTP_STATUS_CODES,
  type SpaceRefString,
  XrpcError,
  xrpc,
} from '@atproto/lex'
import { LtHash, spaceHostAud } from '@atproto/space'
import { SpaceRef } from '@atproto/syntax'
import { XRPCError } from '@atproto/xrpc-server'
import type { SpaceNotificationRetry } from './account-manager/db/index.js'
import {
  processNotifyWrite,
  resolveNotifyTarget,
} from './api/com/atproto/space/util.js'
import type { AppContext } from './context.js'
import { com } from './lexicons/index.js'
import { spaceLogger } from './logger.js'

/**
 * Sends notifications immediately; retryable failures are coalesced in the
 * account-manager DB. Each newer revision resets the backoff and 24-hour window.
 * An expiring lease selects one retry worker across processes, allowing takeover
 * if that worker stops.
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
    space: SpaceRefString,
    repo: DidString,
    commit: { rev: string; setHash: Uint8Array },
  ): Promise<void> {
    const body = {
      space,
      repo,
      repoRev: commit.rev,
      hash: new LtHash(commit.setHash).digest(),
    }
    try {
      await this.deliver(body)
      await this.clearRetry(body)
    } catch (err) {
      if (!isRetryableError(err)) {
        await this.clearRetry(body)
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
          .values({ ...body, ...schedule })
          .onConflict((oc) =>
            oc
              .columns(['repo', 'space'])
              .doUpdateSet({
                repoRev: body.repoRev,
                hash: body.hash,
                ...schedule,
              })
              .where('space_notification_retry.repoRev', '<', body.repoRev),
          ),
      )
      spaceLogger.warn(
        { err, space, repo },
        'space notification queued for retry',
      )
    }
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
      if (!retries.length) return
      if (this.abortController.signal.aborted || Date.now() >= expiresAt) return

      // @NOTE Renew between batches; lease expiry can cause duplicate delivery.
      await allFulfilled(
        retries.map(async (retry) => {
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
      )
    }
  }

  private async retryOne(retry: SpaceNotificationRetry): Promise<void> {
    const { space, repo, repoRev, hash } = retry
    try {
      await this.deliver({ space, repo, repoRev, hash })
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
    body: com.atproto.space.notifyWrite.$InputBody,
  ): Promise<void> {
    const signal = AbortSignal.any([
      this.abortController.signal,
      AbortSignal.timeout(10 * SECOND),
    ])
    signal.throwIfAborted()
    const { spaceDid } = SpaceRef.parse(body.space)
    const owner = await this.ctx.accountManager.getAccount(spaceDid)
    if (owner) {
      await processNotifyWrite(this.ctx, body)
    } else {
      const target = await resolveNotifyTarget(this.ctx, {
        iss: body.repo,
        service: spaceHostAud(spaceDid),
        lxm: com.atproto.space.notifyWrite.$lxm,
      })
      if (!target) throw new Error('Could not resolve space host')
      await xrpc(target.endpoint, com.atproto.space.notifyWrite, {
        headers: target.headers,
        body,
        signal,
      })
    }
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
  // @NOTE Double the base delay from one minute up to one hour. Jitter of 50-100%
  const delay = Math.min(MINUTE * 2 ** Math.min(attempts - 1, 6), HOUR)
  return Date.now() + Math.floor(delay * (0.5 + Math.random() / 2))
}
