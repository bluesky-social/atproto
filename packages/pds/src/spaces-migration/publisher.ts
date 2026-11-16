import { randomUUID } from 'node:crypto'
import * as plc from '@did-plc/lib'
import {
  type BailableWait,
  DAY,
  HOUR,
  MINUTE,
  SECOND,
  bailableWait,
} from '@atproto/common'
import type { DidString } from '@atproto/syntax'
import type { SpacesMigrationConfig } from '../config/config.js'
import type { AppContext } from '../context.js'
import { spacesMigrationLogger as log } from '../logger.js'
import { backoffMs } from './pacing.js'
import type { SpacesMigrationProgress } from './progress.js'
import {
  LeaseLostError,
  PlcTimeoutError,
  type PublishContext,
  publishAccount,
} from './publish.js'

export type SpacesMigrationPublisherState =
  | 'waiting' // for the start time
  | 'running'
  | 'backoff' // PLC asked us to slow down
  | 'idle' // nothing due
  | 'entryway' // the entryway publishes instead
  | 'disabled'

export type SpacesMigrationPublisherOptions = SpacesMigrationConfig & {
  /** How often to look for new work while there is none. */
  pollIntervalMs?: number
  /** Identifies this process in row leases. */
  owner?: string
  /** Bounds each PLC call. */
  plcTimeoutMs?: number
  /** Bounds how long destroy() waits for the step in flight. */
  destroyTimeoutMs?: number
}

export type PublisherContext = PublishContext &
  Pick<AppContext, 'entrywayClient'>

const LEASE_MS = 5 * MINUTE
const RETRY_BASE_MS = MINUTE
const RETRY_CAP_MS = DAY
const PLC_BACKOFF_BASE_MS = 30 * SECOND
const PLC_BACKOFF_CAP_MS = HOUR

/**
 * Publishes every account's KEM key, one account at a time at a gentle pace,
 * starting after a delay derived from the hostname so that hosts don't all
 * load PLC at once. Prioritized accounts skip the delay and the pace. When PLC
 * pushes back (429 or 5xx) the whole publisher backs off, not just the account.
 * Several processes can run one each: rows are leased.
 */
export class SpacesMigrationPublisher implements AsyncDisposable {
  state: SpacesMigrationPublisherState
  readonly owner: string

  private readonly pollIntervalMs: number
  private running?: Promise<void>
  private destroyed = false
  private woken = false
  private waiter?: BailableWait
  private startAt?: number
  private plcBackoffs = 0
  private plcBackoffUntil = 0

  constructor(
    private readonly ctx: PublisherContext,
    private readonly progress: SpacesMigrationProgress,
    private readonly opts: SpacesMigrationPublisherOptions = ctx.cfg
      .spacesMigration,
  ) {
    this.owner = opts.owner ?? randomUUID()
    this.pollIntervalMs = opts.pollIntervalMs ?? MINUTE
    this.state = ctx.entrywayClient
      ? 'entryway'
      : opts.disabled
        ? 'disabled'
        : 'waiting'
  }

  start(): void {
    if (this.state === 'entryway' || this.state === 'disabled') return
    this.running ??= this.run()
  }

  /** Looks for work now, e.g. after an account was prioritized. */
  wake(): void {
    this.woken = true
    this.waiter?.bail()
  }

  async destroy(): Promise<void> {
    this.destroyed = true
    this.waiter?.bail()
    if (!this.running) return
    // A stuck step mustn't hold up shutdown. Its lease expires on its own.
    const timeoutMs = this.opts.destroyTimeoutMs ?? 10 * SECOND
    const timeout = bailableWait(timeoutMs)
    const stopped = await Promise.race([
      this.running.then(() => true),
      timeout.wait().then(() => false),
    ]).finally(() => {
      // Don't keep the process alive once the loop has stopped
      timeout.bail()
    })
    if (!stopped) {
      log.warn({ timeoutMs }, 'spaces migration publisher did not stop in time')
    }
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy()
  }

  private async run(): Promise<void> {
    while (!this.destroyed) {
      let delayMs: number
      try {
        delayMs = await this.step()
      } catch (err) {
        log.error({ err }, 'spaces migration publisher failed, will retry')
        delayMs = this.pollIntervalMs
      }
      await this.sleep(delayMs)
    }
  }

  // Publishes at most one account. Returns how long to wait before the next.
  private async step(): Promise<number> {
    if (this.startAt === undefined) {
      await this.progress.seed()
      this.startAt = await this.progress.publishStartAt(
        this.ctx.cfg.service.hostname,
        this.opts.jitterWindowMs,
        Date.now(),
      )
      log.info(
        { publishStartAt: new Date(this.startAt).toISOString() },
        'spaces migration publisher started',
      )
    }

    const now = Date.now()
    if (now < this.plcBackoffUntil) {
      this.state = 'backoff'
      return this.plcBackoffUntil - now
    }

    const beforeStart = now < this.startAt
    let [did] = await this.progress.claimDue(this.owner, now, 1, LEASE_MS, {
      priorityOnly: true,
    })
    const priority = did !== undefined
    if (!priority && !beforeStart) {
      ;[did] = await this.progress.claimDue(this.owner, now, 1, LEASE_MS)
    }
    if (did === undefined) {
      this.state = beforeStart ? 'waiting' : 'idle'
      return beforeStart
        ? Math.min(this.pollIntervalMs, this.startAt - now)
        : this.pollIntervalMs
    }

    this.state = 'running'
    await this.publish(did)
    return priority ? 0 : this.opts.publishIntervalMs
  }

  private async publish(did: DidString): Promise<void> {
    const { owner, progress } = this
    try {
      const outcome = await publishAccount(
        this.ctx,
        did,
        () => progress.holdsLease(did, owner, Date.now()),
        { plcTimeoutMs: this.opts.plcTimeoutMs },
      )
      if (outcome === 'published') {
        await progress.recordPublished(did, owner)
      } else if (outcome === 'deleted') {
        await progress.remove(did, owner)
      } else {
        await progress.recordUnpublishable(did, owner, outcome.unpublishable)
      }
      this.plcBackoffs = 0
    } catch (err) {
      if (err instanceof LeaseLostError) {
        log.warn({ did }, 'lost the spaces migration lease, skipping')
      } else if (isPlcBackpressure(err)) {
        // Not the account's fault: retry it once PLC recovers
        await progress.release(did, owner)
        const delayMs = backoffMs(
          this.plcBackoffs++,
          PLC_BACKOFF_BASE_MS,
          PLC_BACKOFF_CAP_MS,
        )
        this.plcBackoffUntil = Date.now() + delayMs
        this.state = 'backoff'
        log.warn(
          { did, err, delayMs },
          'plc pushed back, spaces migration publisher backing off',
        )
      } else {
        const attempts = (await progress.get(did))?.attempts ?? 0
        const nextAttemptAt =
          Date.now() + backoffMs(attempts, RETRY_BASE_MS, RETRY_CAP_MS)
        await progress.recordFailure(did, owner, err, nextAttemptAt)
        log.error(
          { err, did, attempt: attempts + 1 },
          'failed to publish kem key',
        )
      }
    }
  }

  private async sleep(ms: number): Promise<void> {
    if (this.destroyed) return
    if (this.woken) {
      this.woken = false
      return
    }
    this.waiter = bailableWait(Math.max(0, ms))
    await this.waiter.wait()
    this.waiter = undefined
    this.woken = false
  }
}

// PLC is overloaded or down: 429, 5xx (incl. network errors), or no answer
function isPlcBackpressure(err: unknown): boolean {
  return (
    err instanceof PlcTimeoutError ||
    (err instanceof plc.PlcClientError &&
      (err.status === 429 || err.status >= 500))
  )
}
