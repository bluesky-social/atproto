import type { Selectable, UpdateObject } from 'kysely'
import type { DidString } from '@atproto/syntax'
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
  failing: number
  /** Accounts whose store sweep is failing. */
  sweepFailing: number
}

const SEED_BATCH_SIZE = 500

/**
 * Adds a new account's row. An account whose genesis op published its KEM key
 * is born done, so the publisher never re-sequences `#identity` for it.
 */
export async function registerSpacesMigration(
  db: AccountDb,
  did: DidString,
  opts: { kemPublished?: boolean },
): Promise<void> {
  const now = new Date().toISOString()
  // A new store is created at the latest schema
  const values = {
    storeMigratedAt: now,
    kemPublishedAt: opts.kemPublished ? now : null,
    unpublishableReason: null,
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
    priority: 0,
    leaseOwner: null,
    leaseExpiresAt: 0,
    sweepLeaseOwner: null,
    sweepLeaseExpiresAt: 0,
    sweepAttempts: 0,
    sweepLastError: null,
    sweepNextAttemptAt: 0,
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
 * The account DB's record of each account's migration into spaces. Columns
 * record facts (store migrated, key published, why it can't be published,
 * failures) rather than a single state. Background workers claim rows with
 * per-row leases so that several processes can share the work.
 */
export class SpacesMigrationProgress {
  constructor(public db: AccountDb) {}

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
   * Leases up to `limit` accounts whose key is due to be published, highest
   * priority first. With `priorityOnly`, only prioritized accounts.
   */
  async claimDue(
    owner: string,
    now: number,
    limit: number,
    leaseMs: number,
    opts?: { priorityOnly?: boolean },
  ): Promise<DidString[]> {
    const { db } = this.db
    let due = db
      .selectFrom('spaces_migration')
      .select('did')
      .where('kemPublishedAt', 'is', null)
      .where('unpublishableReason', 'is', null)
      .where('nextAttemptAt', '<=', now)
      .where((eb) =>
        eb.or([eb('leaseOwner', 'is', null), eb('leaseExpiresAt', '<=', now)]),
      )
      // A deactivated account may be migrating in, its DID doc not yet
      // pointing here. It is published once activated.
      .where(({ not, exists, selectFrom }) =>
        not(
          exists(
            selectFrom('actor')
              .select('actor.did')
              .whereRef('actor.did', '=', 'spaces_migration.did')
              .where('actor.deactivatedAt', 'is not', null),
          ),
        ),
      )
      .orderBy('priority', 'desc')
      .orderBy('nextAttemptAt', 'asc')
      .limit(limit)
    if (opts?.priorityOnly) due = due.where('priority', '>', 0)
    // One statement, so the lease is taken atomically: the conditions are
    // re-checked against each row as it is updated
    const claimed = await this.db.executeWithRetry(
      db
        .updateTable('spaces_migration')
        .set({ leaseOwner: owner, leaseExpiresAt: now + leaseMs })
        .where('did', 'in', due)
        .where('kemPublishedAt', 'is', null)
        .where('unpublishableReason', 'is', null)
        .where((eb) =>
          eb.or([
            eb('leaseOwner', 'is', null),
            eb('leaseExpiresAt', '<=', now),
          ]),
        )
        .returning('did'),
    )
    return claimed.map(({ did }) => did)
  }

  /** Leases up to `limit` accounts whose store hasn't been swept. */
  async claimUnswept(
    owner: string,
    now: number,
    limit: number,
    leaseMs: number,
  ): Promise<DidString[]> {
    const { db } = this.db
    const unswept = db
      .selectFrom('spaces_migration')
      .select('did')
      .where('storeMigratedAt', 'is', null)
      .where('sweepNextAttemptAt', '<=', now)
      .where((eb) =>
        eb.or([
          eb('sweepLeaseOwner', 'is', null),
          eb('sweepLeaseExpiresAt', '<=', now),
        ]),
      )
      .limit(limit)
    const claimed = await this.db.executeWithRetry(
      db
        .updateTable('spaces_migration')
        .set({ sweepLeaseOwner: owner, sweepLeaseExpiresAt: now + leaseMs })
        .where('did', 'in', unswept)
        .where('storeMigratedAt', 'is', null)
        .where('sweepNextAttemptAt', '<=', now)
        .where((eb) =>
          eb.or([
            eb('sweepLeaseOwner', 'is', null),
            eb('sweepLeaseExpiresAt', '<=', now),
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
          storeMigratedAt: new Date().toISOString(),
          sweepLeaseOwner: null,
          sweepLeaseExpiresAt: 0,
          sweepAttempts: 0,
          sweepLastError: null,
          sweepNextAttemptAt: 0,
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
          sweepNextAttemptAt: nextAttemptAt,
          sweepLeaseOwner: null,
          sweepLeaseExpiresAt: 0,
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
          publishStartAt: now + jitterDelayMs(hostname, windowMs),
        })
        .onConflict((oc) => oc.doNothing()),
    )
    const state = await this.db.db
      .selectFrom('spaces_migration_state')
      .select('publishStartAt')
      .where('id', '=', 1)
      .executeTakeFirstOrThrow()
    return state.publishStartAt
  }

  async holdsLease(did: DidString, owner: string, now: number) {
    const held = await this.db.db
      .selectFrom('spaces_migration')
      .select('did')
      .where('did', '=', did)
      .where('leaseOwner', '=', owner)
      .where('leaseExpiresAt', '>', now)
      .executeTakeFirst()
    return held !== undefined
  }

  async recordPublished(did: DidString, owner: string): Promise<void> {
    await this.updateLeased(did, owner, {
      kemPublishedAt: new Date().toISOString(),
      unpublishableReason: null,
      attempts: 0,
      lastError: null,
      nextAttemptAt: 0,
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
      nextAttemptAt,
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
          kemPublishedAt: new Date().toISOString(),
          unpublishableReason: check.unpublishableReason,
        }
      : {
          kemPublishedAt: null,
          unpublishableReason: check.unpublishableReason,
          attempts: 0,
          lastError: null,
          nextAttemptAt: 0,
        }
    await this.db.executeWithRetry(
      this.db.db
        .insertInto('spaces_migration')
        .values({ did, ...values })
        .onConflict((oc) => oc.column('did').doUpdateSet(values)),
    )
  }

  /** Publishes the account ahead of others, and before the start delay. */
  async bump(did: DidString): Promise<void> {
    const values = { priority: 1, nextAttemptAt: 0 }
    await this.db.executeWithRetry(
      this.db.db
        .insertInto('spaces_migration')
        .values({ did, ...values })
        .onConflict((oc) => oc.column('did').doUpdateSet(values)),
    )
  }

  async get(did: DidString): Promise<SpacesMigrationRow | undefined> {
    return this.db.db
      .selectFrom('spaces_migration')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()
  }

  async summary(): Promise<SpacesMigrationSummary> {
    const res = await this.db.db
      .selectFrom('spaces_migration')
      .innerJoin('actor', 'actor.did', 'spaces_migration.did')
      .select((eb) => [
        eb.fn.countAll<number>().as('total'),
        eb.fn.count<number>('storeMigratedAt').as('storesMigrated'),
        eb.fn.count<number>('kemPublishedAt').as('keysPublished'),
        eb.fn
          .sum<number>(
            eb
              .case()
              .when(
                eb.and([
                  eb('kemPublishedAt', 'is', null),
                  eb('unpublishableReason', 'is not', null),
                ]),
              )
              .then(1)
              .else(0)
              .end(),
          )
          .as('unpublishable'),
        eb.fn
          .sum<number>(
            eb
              .case()
              .when(
                eb.and([
                  eb('kemPublishedAt', 'is', null),
                  eb('unpublishableReason', 'is', null),
                  eb('attempts', '>', 0),
                ]),
              )
              .then(1)
              .else(0)
              .end(),
          )
          .as('failing'),
        eb.fn
          .sum<number>(
            eb
              .case()
              .when(
                eb.and([
                  eb('storeMigratedAt', 'is', null),
                  eb('sweepAttempts', '>', 0),
                ]),
              )
              .then(1)
              .else(0)
              .end(),
          )
          .as('sweepFailing'),
      ])
      .executeTakeFirstOrThrow()
    return {
      total: Number(res.total),
      storesMigrated: Number(res.storesMigrated),
      keysPublished: Number(res.keysPublished),
      unpublishable: Number(res.unpublishable ?? 0),
      failing: Number(res.failing ?? 0),
      sweepFailing: Number(res.sweepFailing ?? 0),
    }
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
        .set({ ...values, leaseOwner: null, leaseExpiresAt: 0 })
        .where('did', '=', did)
        .where('leaseOwner', '=', owner),
    )
  }
}

function errorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.slice(0, 1000)
}
