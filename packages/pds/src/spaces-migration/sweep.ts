import { randomUUID } from 'node:crypto'
import {
  type BailableWait,
  MINUTE,
  SECOND,
  bailableWait,
} from '@atproto/common'
import type { DidString } from '@atproto/syntax'
import type { SpacesMigrationConfig } from '../config/config.js'
import type { AppContext } from '../context.js'
import { spacesMigrationLogger as log } from '../logger.js'
import type { SpacesMigrationProgress } from './progress.js'

export type SpacesMigrationSweepState =
  | 'running'
  | 'idle' // nothing left to sweep
  | 'disabled'

export type SpacesMigrationSweepOptions = Pick<
  SpacesMigrationConfig,
  'disabled' | 'sweepIntervalMs'
> & {
  /** How often to look for new work while there is none. */
  pollIntervalMs?: number
  /** Identifies this process in row leases. */
  owner?: string
  /** Bounds how long destroy() waits for the step in flight. */
  destroyTimeoutMs?: number
}

export type SweepContext = Pick<AppContext, 'actorStore' | 'cfg'>

const LEASE_MS = MINUTE

/**
 * Opens every account's actor store, which migrates it to the latest schema,
 * and makes sure the account has a KEM key. Purely local work, so it needs no
 * start delay, and it covers deactivated accounts and runs under an entryway
 * too. Several processes can run one each: rows are leased. A failed account
 * is retried when its lease expires.
 */
export class SpacesMigrationSweep implements AsyncDisposable {
  state: SpacesMigrationSweepState
  readonly owner: string

  private readonly pollIntervalMs: number
  private running?: Promise<void>
  private destroyed = false
  private seeded = false
  private waiter?: BailableWait

  constructor(
    private readonly ctx: SweepContext,
    private readonly progress: SpacesMigrationProgress,
    private readonly opts: SpacesMigrationSweepOptions = ctx.cfg
      .spacesMigration,
  ) {
    this.owner = opts.owner ?? randomUUID()
    this.pollIntervalMs = opts.pollIntervalMs ?? MINUTE
    this.state = opts.disabled ? 'disabled' : 'idle'
  }

  start(): void {
    if (this.state === 'disabled') return
    this.running ??= this.run()
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
      log.warn({ timeoutMs }, 'spaces migration sweep did not stop in time')
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
        log.error({ err }, 'spaces migration sweep failed, will retry')
        delayMs = this.pollIntervalMs
      }
      await this.sleep(delayMs)
    }
  }

  // Sweeps at most one account. Returns how long to wait before the next.
  private async step(): Promise<number> {
    if (!this.seeded) {
      await this.progress.seed()
      this.seeded = true
    }
    const [did] = await this.progress.claimUnswept(
      this.owner,
      Date.now(),
      1,
      LEASE_MS,
    )
    if (did === undefined) {
      this.state = 'idle'
      return this.pollIntervalMs
    }
    this.state = 'running'
    await this.sweep(did)
    return this.opts.sweepIntervalMs
  }

  private async sweep(did: DidString): Promise<void> {
    const { actorStore } = this.ctx
    const { owner, progress } = this
    try {
      if (!(await actorStore.exists(did))) {
        await progress.removeSwept(did, owner)
        return
      }
      // Opening the store migrates it
      await actorStore.read(did, () => {})
      await actorStore.ensureKemKeypair(did)
      await progress.recordSwept(did, owner)
    } catch (err) {
      // The lease expires and the account is tried again
      log.error({ err, did }, 'failed to sweep actor store')
    }
  }

  private async sleep(ms: number): Promise<void> {
    if (this.destroyed) return
    this.waiter = bailableWait(Math.max(0, ms))
    await this.waiter.wait()
    this.waiter = undefined
  }
}
