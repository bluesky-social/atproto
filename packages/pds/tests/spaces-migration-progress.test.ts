import { jest } from '@jest/globals'
import { type Compilable, CompiledQuery } from 'kysely'
import {
  type DidString,
  currentDatetimeString,
  toDatetimeString,
} from '@atproto/syntax'
import {
  type AccountDb,
  getDb,
  getMigrator,
} from '../src/account-manager/db/index.js'
import {
  SpacesMigrationProgress,
  unparkSpacesMigration,
} from '../src/spaces-migration/progress.js'

describe('spaces migration progress', () => {
  let db: AccountDb
  let progress: SpacesMigrationProgress
  let counter = 0

  beforeEach(async () => {
    db = getDb(':memory:')
    await getMigrator(db).migrateToLatestOrThrow()
    progress = new SpacesMigrationProgress(db)
  })

  afterEach(async () => {
    await db.close()
  })

  const addAccount = async (
    opts: { deactivated?: boolean; row?: Record<string, unknown> } = {},
  ) => {
    const did = `did:plc:progress${counter++}` as DidString
    await db.db
      .insertInto('actor')
      .values({
        did,
        handle: null,
        createdAt: currentDatetimeString(),
        deactivatedAt: opts.deactivated ? currentDatetimeString() : null,
      })
      .execute()
    await db.db
      .insertInto('spaces_migration')
      .values({ did, ...opts.row })
      .execute()
    return did
  }

  // A datetime at or before now; null is parked, never due
  const isDue = (at: string | null) =>
    at !== null && at <= currentDatetimeString()

  const row = (did: DidString) =>
    db.db
      .selectFrom('spaces_migration')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirstOrThrow()

  // The query plan of each statement the claim runs
  const planOf = async (claim: () => Promise<unknown>) => {
    const queries: Compilable[] = []
    using _spy = jest
      .spyOn(db, 'executeWithRetry')
      .mockImplementation(async (query) => {
        // The claims pass query builders, which compile
        queries.push(query as unknown as Compilable)
        return []
      })
    await claim()
    const plans: string[] = []
    for (const query of queries) {
      const { sql: text, parameters } = query.compile()
      const { rows } = await db.db.executeQuery<{ detail: string }>(
        CompiledQuery.raw(`explain query plan ${text}`, [...parameters]),
      )
      plans.push(...rows.map((r) => r.detail))
    }
    return plans.join('\n')
  }

  it('defaults new rows to due now, formatted as datetimes compare', async () => {
    const did = await addAccount()
    const { nextAttemptAt, sweepNextAttemptAt } = await row(did)
    for (const at of [nextAttemptAt, sweepNextAttemptAt]) {
      // The db's default must match JS's format, or string comparison breaks
      expect(at).toBe(toDatetimeString(at ?? ''))
      expect(isDue(at)).toBe(true)
    }
  })

  describe('claimDue', () => {
    it('bounds its index scan by the due time', async () => {
      const plan = await planOf(() =>
        progress.claimDue('owner', Date.now(), 1, 1000, 0),
      )
      expect(plan).toContain(
        'USING INDEX spaces_migration_due_idx (priority=? AND nextAttemptAt<?)',
      )
    })

    it('claims only the given priority', async () => {
      const low = await addAccount()
      const high = await addAccount({ row: { priority: 1 } })
      expect(await progress.claimDue('owner', Date.now(), 10, 1000, 1)).toEqual(
        [high],
      )
      expect(await progress.claimDue('owner', Date.now(), 10, 1000, 0)).toEqual(
        [low],
      )
    })

    it('claims deactivated accounts, so that they can be parked', async () => {
      const did = await addAccount({ deactivated: true })
      expect(await progress.claimDue('owner', Date.now(), 10, 1000, 0)).toEqual(
        [did],
      )
    })

    it('never claims a parked account', async () => {
      await addAccount({ deactivated: true, row: { nextAttemptAt: null } })
      expect(await progress.claimDue('owner', Date.now(), 10, 1000, 0)).toEqual(
        [],
      )
    })
  })

  describe('parkIfDeactivated', () => {
    it('parks a deactivated account and releases its lease', async () => {
      const did = await addAccount({ deactivated: true })
      await progress.claimDue('owner', Date.now(), 1, 1000, 0)
      expect(await progress.parkIfDeactivated(did, 'owner')).toBe(true)
      expect(await row(did)).toMatchObject({
        nextAttemptAt: null,
        leaseOwner: null,
        attempts: 0,
      })
    })

    it('leaves an account activated since it was claimed', async () => {
      const did = await addAccount({ deactivated: true })
      await progress.claimDue('owner', Date.now(), 1, 1000, 0)
      await db.db
        .updateTable('actor')
        .set({ deactivatedAt: null })
        .where('did', '=', did)
        .execute()
      expect(await progress.parkIfDeactivated(did, 'owner')).toBe(false)
      const kept = await row(did)
      expect(kept.leaseOwner).toBe('owner')
      expect(isDue(kept.nextAttemptAt)).toBe(true)
    })

    it('does nothing without the lease', async () => {
      const did = await addAccount({ deactivated: true })
      await progress.claimDue('other', Date.now(), 1, 1000, 0)
      expect(await progress.parkIfDeactivated(did, 'owner')).toBe(false)
      expect(isDue((await row(did)).nextAttemptAt)).toBe(true)
    })
  })

  describe('unparkSpacesMigration', () => {
    it('makes a parked account due', async () => {
      const did = await addAccount({ row: { nextAttemptAt: null } })
      await unparkSpacesMigration(db, did)
      expect(isDue((await row(did)).nextAttemptAt)).toBe(true)
    })

    it('leaves an account that is backing off', async () => {
      const later = toDatetimeString(Date.now() + 60_000)
      const did = await addAccount({ row: { nextAttemptAt: later } })
      await unparkSpacesMigration(db, did)
      expect((await row(did)).nextAttemptAt).toBe(later)
    })
  })

  describe('claimUnswept', () => {
    it('bounds its index scan by the due time', async () => {
      const plan = await planOf(() =>
        progress.claimUnswept('owner', Date.now(), 1, 1000),
      )
      expect(plan).toContain(
        'USING INDEX spaces_migration_unswept_idx (sweepNextAttemptAt<?)',
      )
    })
  })

  describe('summary', () => {
    const now = currentDatetimeString()

    const addMix = async () => {
      await addAccount({ row: { storeMigratedAt: now, kemPublishedAt: now } })
      await addAccount({ row: { storeMigratedAt: now, kemPublishedAt: now } })
      await addAccount({ row: { unpublishableReason: 'did-web' } })
      await addAccount({ deactivated: true })
      await addAccount({ row: { attempts: 2 } })
      await addAccount({ row: { sweepAttempts: 1 } })
      await addAccount()
    }

    const expected = {
      total: 7,
      storesMigrated: 2,
      keysPublished: 2,
      unpublishable: 1,
      deactivated: 1,
      failing: 1,
      sweepFailing: 1,
    }

    it('sums across chunk boundaries', async () => {
      await addMix()
      for (const summaryChunkSize of [1, 2, 3, 7, 100]) {
        const chunked = new SpacesMigrationProgress(db, { summaryChunkSize })
        expect(await chunked.summary()).toEqual(expected)
      }
    })

    it('summarizes an empty table', async () => {
      expect(await progress.summary()).toEqual({
        total: 0,
        storesMigrated: 0,
        keysPublished: 0,
        unpublishable: 0,
        deactivated: 0,
        failing: 0,
        sweepFailing: 0,
      })
    })

    it('yields to the event loop between chunks', async () => {
      await addMix()
      const chunked = new SpacesMigrationProgress(db, { summaryChunkSize: 2 })
      const order: string[] = []
      setImmediate(() => order.push('io'))
      await chunked.summary().then(() => order.push('summary'))
      expect(order).toEqual(['io', 'summary'])
    })
  })
})
