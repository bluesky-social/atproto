import type {
  Expression,
  ExpressionBuilder,
  Selectable,
  SqlBool,
  UpdateObject,
} from 'kysely'
import {
  type DidString,
  currentDatetimeString,
  toDatetimeString,
} from '@atproto/syntax'
import type {
  AccountDb,
  DatabaseSchema,
  SpacesMigration,
} from '../account-manager/db/index.js'
import { jitterDelayMs } from './pacing.js'

export type UnpublishableReason =
  'did-web' | 'rotation-key-not-held' | 'pds-elsewhere' | 'tombstoned'

export type SpacesMigrationRow = Selectable<SpacesMigration>

export type SpacesMigrationSummary = {
  total: number
  storesMigrated: number
  keysPublished: number
  unpublishable: number
  /**
   * Accounts awaiting a key that are deactivated, so not claimed until they
   * activate. A host is done once `total` is `keysPublished + unpublishable +
   * deactivated`.
   */
  deactivated: number
  /** Accounts awaiting a key whose last attempt failed, but not deactivated. */
  failing: number
  /** Accounts whose store sweep is failing. */
  sweepFailing: number
}

const SEED_BATCH_SIZE = 500
// Rows per summary query. Small enough that each one barely blocks the event
// loop, since sqlite queries run synchronously on it.
const SUMMARY_CHUNK_SIZE = 2000

/**
 * Adds a new account's row. An account whose genesis op published its KEM key
 * is born done, so the publisher never re-sequences `#identity` for it.
 */
export async function registerSpacesMigration(
  db: AccountDb,
  did: DidString,
  opts: { kemPublished?: boolean },
): Promise<void> {
  const now = currentDatetimeString()
  // A new store is created at the latest schema
  const values = {
    storeMigratedAt: now,
    kemPublishedAt: opts.kemPublished ? now : null,
    unpublishableReason: null,
    attempts: 0,
    lastError: null,
    nextAttemptAt: now,
    priority: 0,
    leaseOwner: null,
    leaseExpiresAt: null,
    sweepLeaseOwner: null,
    sweepLeaseExpiresAt: null,
    sweepAttempts: 0,
    sweepLastError: null,
    sweepNextAttemptAt: now,
  }
  // Replaces any row left by an earlier account with this DID
  await db.executeWithRetry(
    db.db
      .insertInto('spaces_migration')
      .values({ did, ...values })
      .onConflict((oc) => oc.column('did').doUpdateSet(values)),
  )
}

/**
 * Makes a parked account due, e.g. once it is activated. A parked row's
 * `nextAttemptAt` is null: no attempt is scheduled until an event unparks it.
 */
export async function unparkSpacesMigration(
  db: AccountDb,
  did: DidString,
): Promise<void> {
  await db.executeWithRetry(
    db.db
      .updateTable('spaces_migration')
      .set({ nextAttemptAt: currentDatetimeString() })
      .where('did', '=', did)
      .where('nextAttemptAt', 'is', null),
  )
}

/**
 * The account DB's record of each account's migration into spaces. Columns
 * record facts (store migrated, key published, why it can't be published,
 * failures) rather than a single state. Background workers claim rows with
 * per-row leases so that several processes can share the work.
 */
export class SpacesMigrationProgress {
  private readonly summaryChunkSize: number
  private readonly bumpListeners = new Set<() => void>()

  constructor(
    public db: AccountDb,
    opts: { summaryChunkSize?: number } = {},
  ) {
    this.summaryChunkSize = opts.summaryChunkSize ?? SUMMARY_CHUNK_SIZE
  }

  /** Adds a row for every account without one. Returns the rows added. */
  async seed(): Promise<number> {
    let added = 0
    let cursor: DidString | undefined
    for (;;) {
      let query = this.db.db
        .selectFrom('actor')
        .select('did')
        .orderBy('did')
        .limit(SEED_BATCH_SIZE)
      if (cursor !== undefined) query = query.where('did', '>', cursor)
      const actors = await query.execute()
      if (actors.length === 0) break
      const inserted = await this.db.executeWithRetry(
        this.db.db
          .insertInto('spaces_migration')
          .values(actors.map(({ did }) => ({ did })))
          .onConflict((oc) => oc.doNothing())
          .returning('did'),
      )
      added += inserted.length
      cursor = actors[actors.length - 1].did
    }
    return added
  }

  /**
   * Leases up to `limit` accounts of the given priority whose key is due.
   * Deactivated accounts are claimed too, for the caller to park.
   */
  async claimDue(
    owner: string,
    now: number,
    limit: number,
    leaseMs: number,
    priority: 0 | 1,
  ): Promise<DidString[]> {
    const { db } = this.db
    const nowAt = toDatetimeString(now)
    // Equality on priority lets nextAttemptAt bound the scan of
    // spaces_migration_due_idx
    const due = db
      .selectFrom('spaces_migration')
      .select('did')
      .where('kemPublishedAt', 'is', null)
      .where('unpublishableReason', 'is', null)
      .where('priority', '=', priority)
      .where('nextAttemptAt', '<=', nowAt)
      .where((eb) =>
        eb.or([
          eb('leaseOwner', 'is', null),
          eb('leaseExpiresAt', '<=', nowAt),
        ]),
      )
      .orderBy('nextAttemptAt', 'asc')
      .limit(limit)
    // One statement, so the lease is taken atomically: the conditions are
    // re-checked against each row as it is updated
    const claimed = await this.db.executeWithRetry(
      db
        .updateTable('spaces_migration')
        .set({
          leaseOwner: owner,
          leaseExpiresAt: toDatetimeString(now + leaseMs),
        })
        .where('did', 'in', due)
        .where('kemPublishedAt', 'is', null)
        .where('unpublishableReason', 'is', null)
        .where((eb) =>
          eb.or([
            eb('leaseOwner', 'is', null),
            eb('leaseExpiresAt', '<=', nowAt),
          ]),
        )
        .returning('did'),
    )
    return claimed.map(({ did }) => did)
  }

  /**
   * Parks a leased account if it is deactivated, releasing the lease. A
   * deactivated account may be migrating in, its DID doc not yet pointing
   * here, so it waits for activation to unpark it. Checked in the same
   * statement as the write, so an account activated since its claim is never
   * parked.
   */
  async parkIfDeactivated(did: DidString, owner: string): Promise<boolean> {
    const [res] = await this.db.executeWithRetry(
      this.db.db
        .updateTable('spaces_migration')
        .set({ nextAttemptAt: null, leaseOwner: null, leaseExpiresAt: null })
        .where('did', '=', did)
        .where('leaseOwner', '=', owner)
        .where(({ exists, selectFrom }) =>
          exists(
            selectFrom('actor')
              .select('actor.did')
              .whereRef('actor.did', '=', 'spaces_migration.did')
              .where('actor.deactivatedAt', 'is not', null),
          ),
        ),
    )
    return res.numUpdatedRows > 0
  }

  /** Leases up to `limit` accounts whose store hasn't been swept. */
  async claimUnswept(
    owner: string,
    now: number,
    limit: number,
    leaseMs: number,
  ): Promise<DidString[]> {
    const { db } = this.db
    const nowAt = toDatetimeString(now)
    const unswept = db
      .selectFrom('spaces_migration')
      .select('did')
      .where('storeMigratedAt', 'is', null)
      .where('sweepNextAttemptAt', '<=', nowAt)
      .where((eb) =>
        eb.or([
          eb('sweepLeaseOwner', 'is', null),
          eb('sweepLeaseExpiresAt', '<=', nowAt),
        ]),
      )
      .limit(limit)
    const claimed = await this.db.executeWithRetry(
      db
        .updateTable('spaces_migration')
        .set({
          sweepLeaseOwner: owner,
          sweepLeaseExpiresAt: toDatetimeString(now + leaseMs),
        })
        .where('did', 'in', unswept)
        .where('storeMigratedAt', 'is', null)
        .where('sweepNextAttemptAt', '<=', nowAt)
        .where((eb) =>
          eb.or([
            eb('sweepLeaseOwner', 'is', null),
            eb('sweepLeaseExpiresAt', '<=', nowAt),
          ]),
        )
        .returning('did'),
    )
    return claimed.map(({ did }) => did)
  }

  async recordSwept(did: DidString, owner: string): Promise<void> {
    await this.db.executeWithRetry(
      this.db.db
        .updateTable('spaces_migration')
        .set({
          storeMigratedAt: currentDatetimeString(),
          sweepLeaseOwner: null,
          sweepLeaseExpiresAt: null,
          sweepAttempts: 0,
          sweepLastError: null,
        })
        .where('did', '=', did)
        .where('sweepLeaseOwner', '=', owner),
    )
  }

  /** Records a failed sweep and gives up the lease until `nextAttemptAt`. */
  async recordSweepFailure(
    did: DidString,
    owner: string,
    err: unknown,
    nextAttemptAt: number,
  ): Promise<void> {
    await this.db.executeWithRetry(
      this.db.db
        .updateTable('spaces_migration')
        .set({
          sweepAttempts: (eb) => eb('sweepAttempts', '+', 1),
          sweepLastError: errorMessage(err),
          sweepNextAttemptAt: toDatetimeString(nextAttemptAt),
          sweepLeaseOwner: null,
          sweepLeaseExpiresAt: null,
        })
        .where('did', '=', did)
        .where('sweepLeaseOwner', '=', owner),
    )
  }

  /** Removes the row of an unswept account that no longer exists. */
  async removeSwept(did: DidString, owner: string): Promise<void> {
    await this.db.executeWithRetry(
      this.db.db
        .deleteFrom('spaces_migration')
        .where('did', '=', did)
        .where('sweepLeaseOwner', '=', owner),
    )
  }

  /**
   * When the publisher starts. The first process to ask fixes it, and every
   * later start (restarts, rollbacks, re-upgrades) reads it back.
   */
  async publishStartAt(
    hostname: string,
    windowMs: number,
    now: number,
  ): Promise<number> {
    await this.db.executeWithRetry(
      this.db.db
        .insertInto('spaces_migration_state')
        .values({
          id: 1,
          publishStartAt: toDatetimeString(
            now + jitterDelayMs(hostname, windowMs),
          ),
        })
        .onConflict((oc) => oc.doNothing()),
    )
    const state = await this.db.db
      .selectFrom('spaces_migration_state')
      .select('publishStartAt')
      .where('id', '=', 1)
      .executeTakeFirstOrThrow()
    return Date.parse(state.publishStartAt)
  }

  async holdsLease(did: DidString, owner: string, now: number) {
    const held = await this.db.db
      .selectFrom('spaces_migration')
      .select('did')
      .where('did', '=', did)
      .where('leaseOwner', '=', owner)
      .where('leaseExpiresAt', '>', toDatetimeString(now))
      .executeTakeFirst()
    return held !== undefined
  }

  async recordPublished(did: DidString, owner: string): Promise<void> {
    await this.updateLeased(did, owner, {
      kemPublishedAt: currentDatetimeString(),
      unpublishableReason: null,
      attempts: 0,
      lastError: null,
    })
  }

  async recordUnpublishable(
    did: DidString,
    owner: string,
    reason: UnpublishableReason,
  ): Promise<void> {
    await this.updateLeased(did, owner, { unpublishableReason: reason })
  }

  async recordFailure(
    did: DidString,
    owner: string,
    err: unknown,
    nextAttemptAt: number,
  ): Promise<void> {
    await this.updateLeased(did, owner, {
      attempts: (eb) => eb('attempts', '+', 1),
      lastError: errorMessage(err),
      nextAttemptAt: toDatetimeString(nextAttemptAt),
    })
  }

  /** Gives up the lease without recording anything. */
  async release(did: DidString, owner: string): Promise<void> {
    await this.updateLeased(did, owner, {})
  }

  /** Removes the row of an account that no longer exists. */
  async remove(did: DidString, owner: string): Promise<void> {
    await this.db.executeWithRetry(
      this.db.db
        .deleteFrom('spaces_migration')
        .where('did', '=', did)
        .where('leaseOwner', '=', owner),
    )
  }

  /**
   * Corrects the record from a live check of the account. Needs no lease.
   * Clearing `kemPublishedAt` re-queues the account.
   */
  async recordChecked(
    did: DidString,
    check: {
      published: boolean
      unpublishableReason: UnpublishableReason | null
    },
  ): Promise<void> {
    const values = check.published
      ? {
          kemPublishedAt: currentDatetimeString(),
          unpublishableReason: check.unpublishableReason,
        }
      : {
          kemPublishedAt: null,
          unpublishableReason: check.unpublishableReason,
          attempts: 0,
          lastError: null,
          nextAttemptAt: currentDatetimeString(),
        }
    await this.db.executeWithRetry(
      this.db.db
        .insertInto('spaces_migration')
        .values({ did, ...values })
        .onConflict((oc) => oc.column('did').doUpdateSet(values)),
    )
  }

  /** Calls `listener` after each bump, e.g. to wake the publisher. */
  onBump(listener: () => void): () => void {
    this.bumpListeners.add(listener)
    return () => this.bumpListeners.delete(listener)
  }

  /** Publishes the account ahead of others, and before the start delay. */
  async bump(did: DidString): Promise<void> {
    const values = { priority: 1, nextAttemptAt: currentDatetimeString() }
    await this.db.executeWithRetry(
      this.db.db
        .insertInto('spaces_migration')
        .values({ did, ...values })
        .onConflict((oc) => oc.column('did').doUpdateSet(values)),
    )
    for (const listener of this.bumpListeners) listener()
  }

  async get(did: DidString): Promise<SpacesMigrationRow | undefined> {
    return this.db.db
      .selectFrom('spaces_migration')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()
  }

  /**
   * Counts in chunks of rows, yielding to the event loop between them. Chunks
   * are read at different moments, so under concurrent writes the counts are
   * approximate, but each row is counted exactly once.
   */
  async summary(): Promise<SpacesMigrationSummary> {
    const totals: SpacesMigrationSummary = {
      total: 0,
      storesMigrated: 0,
      keysPublished: 0,
      unpublishable: 0,
      deactivated: 0,
      failing: 0,
      sweepFailing: 0,
    }
    let cursor: DidString | undefined
    for (;;) {
      const chunk = await this.summarizeChunk(cursor)
      if (chunk.last === null) return totals
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
        totals[key] += Number(chunk[key] ?? 0)
      }
      cursor = chunk.last
      await yieldToEventLoop()
    }
  }

  private async summarizeChunk(after: DidString | undefined) {
    const { db } = this.db
    let rows = db
      .selectFrom('spaces_migration')
      .innerJoin('actor', 'actor.did', 'spaces_migration.did')
      .select([
        'spaces_migration.did',
        'storeMigratedAt',
        'kemPublishedAt',
        'unpublishableReason',
        'attempts',
        'sweepAttempts',
        'actor.deactivatedAt',
      ])
      .orderBy('spaces_migration.did')
      .limit(this.summaryChunkSize)
    if (after !== undefined) {
      rows = rows.where('spaces_migration.did', '>', after)
    }
    const pending = (eb: ExpressionBuilder<ChunkRow, 'chunk'>) =>
      eb.and([
        eb('kemPublishedAt', 'is', null),
        eb('unpublishableReason', 'is', null),
      ])
    const countWhen = (
      eb: ExpressionBuilder<ChunkRow, 'chunk'>,
      cond: Expression<SqlBool>,
    ) => eb.fn.sum<number>(eb.case().when(cond).then(1).else(0).end())
    return db
      .selectFrom(rows.as('chunk'))
      .select((eb) => [
        eb.fn.max<DidString | null>('did').as('last'),
        eb.fn.countAll<number>().as('total'),
        eb.fn.count<number>('storeMigratedAt').as('storesMigrated'),
        eb.fn.count<number>('kemPublishedAt').as('keysPublished'),
        countWhen(
          eb,
          eb.and([
            eb('kemPublishedAt', 'is', null),
            eb('unpublishableReason', 'is not', null),
          ]),
        ).as('unpublishable'),
        countWhen(
          eb,
          eb.and([pending(eb), eb('deactivatedAt', 'is not', null)]),
        ).as('deactivated'),
        countWhen(
          eb,
          eb.and([
            pending(eb),
            eb('deactivatedAt', 'is', null),
            eb('attempts', '>', 0),
          ]),
        ).as('failing'),
        countWhen(
          eb,
          eb.and([
            eb('storeMigratedAt', 'is', null),
            eb('sweepAttempts', '>', 0),
          ]),
        ).as('sweepFailing'),
      ])
      .executeTakeFirstOrThrow()
  }

  // Updates the row and releases its lease, if `owner` still holds it
  private async updateLeased(
    did: DidString,
    owner: string,
    values: UpdateObject<DatabaseSchema, 'spaces_migration'>,
  ): Promise<void> {
    await this.db.executeWithRetry(
      this.db.db
        .updateTable('spaces_migration')
        .set({ ...values, leaseOwner: null, leaseExpiresAt: null })
        .where('did', '=', did)
        .where('leaseOwner', '=', owner),
    )
  }
}

type ChunkRow = {
  chunk: {
    did: DidString
    storeMigratedAt: string | null
    kemPublishedAt: string | null
    unpublishableReason: string | null
    attempts: number
    sweepAttempts: number
    deactivatedAt: string | null
  }
}

const yieldToEventLoop = () =>
  new Promise<void>((resolve) => setImmediate(resolve))

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.slice(0, 1000)
}
