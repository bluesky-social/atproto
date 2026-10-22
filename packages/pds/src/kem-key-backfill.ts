import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import * as plc from '@did-plc/lib'
import { MINUTE, SECOND, fileExists, rmIfExists } from '@atproto/common'
import { P256Keypair } from '@atproto/crypto'
import type { DidString } from '@atproto/lex'
import type { AppContext } from './context.js'
import { spaceLogger } from './logger.js'

/**
 * @TODO remove before beta, along with the `kem_key_backfill_lease` table.
 *
 * Accounts created during the alpha predate `#atproto_kem` keys. This gives each
 * of them one, publishing it to their PLC doc so syncers can find it. Runs in the
 * background; until it reaches an account, that account's space reads fail.
 *
 * A lease selects one process to do the work, and the lease row records when it
 * completes so no process runs it again. An account's key file is written only
 * after its key is published, so the file marks the account as done and a run
 * cut short picks up where it left off. Failed accounts are retried until every
 * account succeeds.
 */
export class KemKeyBackfill implements AsyncDisposable {
  private readonly owner = randomUUID()
  private abortController = new AbortController()
  private running?: Promise<void>

  constructor(
    private readonly ctx: AppContext,
    private readonly opts = { leaseMs: MINUTE, pollMs: 10 * SECOND },
  ) {}

  private get db() {
    return this.ctx.accountManager.db
  }

  start(): void {
    // The entryway owns PLC ops for its accounts
    if (this.ctx.entrywayClient) return
    this.running ??= this.run()
  }

  /** Resolves once the backfill has completed, here or in another process. */
  async run(): Promise<void> {
    const { signal } = this.abortController
    while (!signal.aborted) {
      try {
        if (await this.attempt()) return
      } catch (err) {
        spaceLogger.error({ err }, 'kem key backfill failed, will retry')
      }
      await sleep(this.opts.pollMs, undefined, { signal }).catch(() => {})
    }
  }

  // True once the backfill has completed.
  private async attempt(): Promise<boolean> {
    if (await this.isComplete()) return true
    if (!(await this.renewLease())) return false
    try {
      const failed = await this.backfill()
      if (failed > 0) {
        spaceLogger.warn({ failed }, 'kem key backfill will retry')
        return false
      }
      if (this.abortController.signal.aborted) return false
      await this.complete()
      spaceLogger.info('kem key backfill complete')
      return true
    } finally {
      await this.releaseLease()
    }
  }

  // Returns the number of accounts that failed.
  private async backfill(): Promise<number> {
    const { signal } = this.abortController
    let failed = 0
    let cursor: DidString | undefined
    while (!signal.aborted) {
      let query = this.db.db
        .selectFrom('actor')
        .select('did')
        .orderBy('did')
        .limit(100)
      if (cursor) query = query.where('did', '>', cursor)
      const rows = await query.execute()
      if (rows.length === 0) break
      for (const { did } of rows) {
        if (signal.aborted) break
        try {
          await this.backfillAccount(did)
        } catch (err) {
          if (err instanceof LeaseLostError) throw err
          failed++
          spaceLogger.error({ err, did }, 'failed to backfill kem key')
        }
      }
      cursor = rows[rows.length - 1].did
    }
    return failed
  }

  /**
   * Give an account a KEM key if it lacks one. Accounts whose PLC doc this PDS
   * cannot update still get a key, and their owner must publish it themselves.
   *
   * The lease is checked before each step with an effect, so a process that
   * stalled long enough to lose it cannot publish or write a key over another's.
   */
  private async backfillAccount(did: DidString): Promise<void> {
    const { kemKeyLocation } = await this.ctx.actorStore.getLocation(did)
    if (await fileExists(kemKeyLocation)) return
    if (!(await this.ctx.actorStore.exists(did))) return

    const kemKey = await P256Keypair.create({ exportable: true })
    await this.assertLease()
    if (await publishKemKey(this.ctx, did, kemKey.did())) {
      await this.ctx.sequencer.sequenceIdentity(did)
    } else {
      spaceLogger.warn(
        { did },
        'cannot publish kem key, account must update its did doc',
      )
    }

    // The file marks the account done, so it must appear whole or not at all
    const tmpLocation = `${kemKeyLocation}.${randomUUID()}.tmp`
    try {
      await fs.writeFile(tmpLocation, await kemKey.export())
      await this.assertLease()
      await fs.rename(tmpLocation, kemKeyLocation)
    } finally {
      await rmIfExists(tmpLocation)
    }
  }

  private async assertLease(): Promise<void> {
    if (!(await this.renewLease())) throw new LeaseLostError()
  }

  private async isComplete(): Promise<boolean> {
    const lease = await this.db.db
      .selectFrom('kem_key_backfill_lease')
      .select('completedAt')
      .where('id', '=', 1)
      .executeTakeFirstOrThrow()
    return lease.completedAt !== null
  }

  // Acquires the lease, or renews it if this process already holds it.
  private async renewLease(): Promise<boolean> {
    const now = Date.now()
    const [result] = await this.db.executeWithRetry(
      this.db.db
        .updateTable('kem_key_backfill_lease')
        .set({ owner: this.owner, expiresAt: now + this.opts.leaseMs })
        .where('id', '=', 1)
        .where('completedAt', 'is', null)
        .where((eb) =>
          eb.or([eb('owner', '=', this.owner), eb('expiresAt', '<=', now)]),
        ),
    )
    return result.numUpdatedRows > 0n
  }

  private async complete(): Promise<void> {
    await this.db.executeWithRetry(
      this.db.db
        .updateTable('kem_key_backfill_lease')
        .set({ completedAt: new Date().toISOString() })
        .where('id', '=', 1)
        .where('owner', '=', this.owner),
    )
  }

  private async releaseLease(): Promise<void> {
    await this.db.executeWithRetry(
      this.db.db
        .updateTable('kem_key_backfill_lease')
        .set({ owner: '', expiresAt: 0 })
        .where('id', '=', 1)
        .where('owner', '=', this.owner),
    )
  }

  async destroy(): Promise<void> {
    this.abortController.abort()
    await this.running
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.destroy()
  }
}

class LeaseLostError extends Error {
  constructor() {
    super('lost kem key backfill lease')
  }
}

// False when this PDS cannot update the account's PLC doc.
async function publishKemKey(
  ctx: AppContext,
  did: DidString,
  kemKey: string,
): Promise<boolean> {
  if (!did.startsWith('did:plc:')) return false

  const lastOp = await ctx.plcClient.getLastOp(did)
  if (lastOp.type === 'plc_tombstone') return false
  const { rotationKeys, services } = plc.normalizeOp(lastOp)
  if (!rotationKeys.includes(ctx.plcRotationKey.did())) return false
  // Migrated to another PDS
  if (services.atproto_pds?.endpoint !== ctx.cfg.service.publicUrl) {
    return false
  }

  await ctx.plcClient.updateData(did, ctx.plcRotationKey, (op) => ({
    ...op,
    verificationMethods: { ...op.verificationMethods, atproto_kem: kemKey },
  }))
  return true
}
