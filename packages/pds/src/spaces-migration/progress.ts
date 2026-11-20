import {
  type RawBuilder,
  type Selectable,
  type UpdateObject,
  sql,
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
import { events } from '../events.js'
import { spacesMigrationLogger as log } from '../logger.js'
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

const COUNTERS = [
  'total',
  'storesMigrated',
  'keysPublished',
  'unpublishable',
  'deactivated',
  'failing',
  'sweepFailing',
] as const satisfies readonly (keyof SpacesMigrationSummary)[]

// One row's contribution to each counter, over spaces_migration's columns: 1
// if it counts, else 0. Pending rows are deactivated (parked), failing, or
// neither, so with published and unpublishable rows these are disjoint.
const pending = sql`"kemPublishedAt" is null and "unpublishableReason" is null`
const CONTRIBUTION: Record<
  keyof SpacesMigrationSummary,
  RawBuilder<unknown>
> = {
  total: sql`1`,
  storesMigrated: sql`"storeMigratedAt" is not null`,
  keysPublished: sql`"kemPublishedAt" is not null`,
  unpublishable: sql`"kemPublishedAt" is null and "unpublishableReason" is not null`,
  deactivated: sql`${pending} and "nextAttemptAt" is null`,
  failing: sql`${pending} and "nextAttemptAt" is not null and "attempts" > 0`,
  sweepFailing: sql`"storeMigratedAt" is null and "sweepAttempts" > 0`,
}

// Sums of the contributions of spaces_migration's rows, optionally only some
const contributionsOf = (dids?: DidString[]) => sql<SpacesMigrationSummary>`
  select ${sql.join(
    COUNTERS.map(
      (counter) =>
        sql`coalesce(sum(${CONTRIBUTION[counter]}), 0) as ${sql.ref(counter)}`,
    ),
  )}
  from spaces_migration
  ${dids === undefined ? sql`` : sql`where did in (${sql.join(dids)})`}
`

/** Adds (or subtracts) the rows' current contributions to the stats. */
export const statsAdjustment = (dids: DidString[], sign: 1 | -1) => sql`
  update spaces_migration_stats set ${sql.join(
    COUNTERS.map(
      (counter) =>
        sql`${sql.ref(counter)} = ${sql.ref(`spaces_migration_stats.${counter}`)} + ${sql.lit(sign)} * ${sql.ref(`c.${counter}`)}`,
    ),
  )}
  from (${contributionsOf(dids)}) as c
  where spaces_migration_stats.id = 1
`

export async function adjustStats(
  db: AccountDb,
  dids: DidString[],
  sign: 1 | -1,
): Promise<void> {
  if (dids.length === 0) return
  const adjustment = statsAdjustment(dids, sign)
  await db.executeWithRetry({ execute: () => adjustment.execute(db.db) })
}

/**
 * Runs a write to the rows of `dids` with the stats kept up to date, in one
 * transaction: their contributions are taken out before the write and put
 * back after it. Every write that can change a counter goes through here.
 */
export async function trackStats<T>(
  db: AccountDb,
  dids: DidString[],
  write: (db: AccountDb) => Promise<T>,
): Promise<T> {
  const run = async (txn: AccountDb) => {
    await adjustStats(txn, dids, -1)
    const result = await write(txn)
    await adjustStats(txn, dids, 1)
    await reportDrift(txn)
    return result
  }
  return db.isTransaction ? run(db) : db.transaction(run)
}

async function readStats(db: AccountDb): Promise<SpacesMigrationSummary> {
  return db.db
    .selectFrom('spaces_migration_stats')
    .select(COUNTERS)
    .where('id', '=', 1)
    .executeTakeFirstOrThrow()
}

// Stats that no table could produce mean a write went around trackStats().
// Reported, never enforced: drifted counts mustn't fail an account's writes.
async function reportDrift(db: AccountDb): Promise<void> {
  const stats = await readStats(db)
  const possible =
    COUNTERS.every((counter) => stats[counter] >= 0) &&
    stats.keysPublished +
      stats.unpublishable +
      stats.deactivated +
      stats.failing <=
      stats.total &&
    stats.storesMigrated + stats.sweepFailing <= stats.total
  if (!possible) {
    log.error({ stats }, 'spaces migration stats drifted, recount them')
    events.spacesMigrationStatsDrift()
  }
}

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
  await trackStats(db, [did], (txn) =>
    txn.db
      .insertInto('spaces_migration')
      .values({ did, ...values })
      .onConflict((oc) => oc.column('did').doUpdateSet(values))
      .execute(),
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
  await trackStats(db, [did], (txn) =>
    txn.db
      .updateTable('spaces_migration')
      .set({ nextAttemptAt: currentDatetimeString() })
      .where('did', '=', did)
      .where('nextAttemptAt', 'is', null)
      .execute(),
  )
}

/**
 * The account DB's record of each account's migration into spaces. Columns
 * record facts (store migrated, key published, why it can't be published,
 * failures) rather than a single state. Background workers claim rows with
 * per-row leases so that several processes can share the work.
 */
export class SpacesMigrationProgress {
  private readonly bumpListeners = new Set<() => void>()

  constructor(public db: AccountDb) {}

  private tracked<T>(
    dids: DidString[],
    write: (db: AccountDb) => Promise<T>,
  ): Promise<T> {
    return trackStats(this.db, dids, write)
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
      const dids = actors.map(({ did }) => did)
      const inserted = await this.tracked(dids, (txn) =>
        txn.db
          .insertInto('spaces_migration')
          .values(dids.map((did) => ({ did })))
          .onConflict((oc) => oc.doNothing())
          .returning('did')
          .execute(),
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
    const [res] = await this.tracked([did], (txn) =>
      txn.db
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
        )
        .execute(),
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
    await this.tracked([did], (txn) =>
      txn.db
        .updateTable('spaces_migration')
        .set({
          storeMigratedAt: currentDatetimeString(),
          sweepLeaseOwner: null,
          sweepLeaseExpiresAt: null,
          sweepAttempts: 0,
          sweepLastError: null,
        })
        .where('did', '=', did)
        .where('sweepLeaseOwner', '=', owner)
        .execute(),
    )
  }

  /** Records a failed sweep and gives up the lease until `nextAttemptAt`. */
  async recordSweepFailure(
    did: DidString,
    owner: string,
    err: unknown,
    nextAttemptAt: number,
  ): Promise<void> {
    await this.tracked([did], (txn) =>
      txn.db
        .updateTable('spaces_migration')
        .set({
          sweepAttempts: (eb) => eb('sweepAttempts', '+', 1),
          sweepLastError: errorMessage(err),
          sweepNextAttemptAt: toDatetimeString(nextAttemptAt),
          sweepLeaseOwner: null,
          sweepLeaseExpiresAt: null,
        })
        .where('did', '=', did)
        .where('sweepLeaseOwner', '=', owner)
        .execute(),
    )
  }

  /** Removes the row of an unswept account that no longer exists. */
  async removeSwept(did: DidString, owner: string): Promise<void> {
    await this.tracked([did], (txn) =>
      txn.db
        .deleteFrom('spaces_migration')
        .where('did', '=', did)
        .where('sweepLeaseOwner', '=', owner)
        .execute(),
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

  /** Gives up the lease without recording anything. Changes no counter. */
  async release(did: DidString, owner: string): Promise<void> {
    await this.db.executeWithRetry(this.leasedUpdate(this.db, did, owner, {}))
  }

  /** Removes the row of an account that no longer exists. */
  async remove(did: DidString, owner: string): Promise<void> {
    await this.tracked([did], (txn) =>
      txn.db
        .deleteFrom('spaces_migration')
        .where('did', '=', did)
        .where('leaseOwner', '=', owner)
        .execute(),
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
    await this.tracked([did], (txn) =>
      txn.db
        .insertInto('spaces_migration')
        .values({ did, ...values })
        .onConflict((oc) => oc.column('did').doUpdateSet(values))
        .execute(),
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
    await this.tracked([did], (txn) =>
      txn.db
        .insertInto('spaces_migration')
        .values({ did, ...values })
        .onConflict((oc) => oc.column('did').doUpdateSet(values))
        .execute(),
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

  /** The stats, as kept up to date by every write. One row, by key. */
  async summary(): Promise<SpacesMigrationSummary> {
    return readStats(this.db)
  }

  /**
   * Compares the stats with a fresh count, and with `fix` overwrites them.
   * Holds sqlite's write lock throughout, so no tracked write lands between
   * the count and the overwrite: the result is exact. Blocks writes for one
   * scan of the table.
   */
  async recountStats(opts: { fix: boolean }): Promise<{
    stored: SpacesMigrationSummary
    recounted: SpacesMigrationSummary
    fixed: boolean
  }> {
    return this.db.transaction(async (txn) => {
      // A write first takes the write lock before anything is read
      await txn.db
        .updateTable('spaces_migration_stats')
        .set({ id: 1 })
        .where('id', '=', 1)
        .execute()
      const stored = await readStats(txn)
      const recounted = await this.recount(txn)
      if (opts.fix) {
        await txn.db
          .updateTable('spaces_migration_stats')
          .set(recounted)
          .where('id', '=', 1)
          .execute()
      }
      return { stored, recounted, fixed: opts.fix }
    })
  }

  /** Counts every row afresh: one scan of the table, for checking the stats. */
  async recount(db: AccountDb = this.db): Promise<SpacesMigrationSummary> {
    const { rows } = await contributionsOf().execute(db.db)
    const [counts] = rows
    return Object.fromEntries(
      COUNTERS.map((counter) => [counter, Number(counts[counter])]),
    ) as SpacesMigrationSummary
  }

  // Updates the row and releases its lease, if `owner` still holds it
  private async updateLeased(
    did: DidString,
    owner: string,
    values: UpdateObject<DatabaseSchema, 'spaces_migration'>,
  ): Promise<void> {
    await this.tracked([did], (txn) =>
      this.leasedUpdate(txn, did, owner, values).execute(),
    )
  }

  private leasedUpdate(
    db: AccountDb,
    did: DidString,
    owner: string,
    values: UpdateObject<DatabaseSchema, 'spaces_migration'>,
  ) {
    return db.db
      .updateTable('spaces_migration')
      .set({ ...values, leaseOwner: null, leaseExpiresAt: null })
      .where('did', '=', did)
      .where('leaseOwner', '=', owner)
  }
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.slice(0, 1000)
}
