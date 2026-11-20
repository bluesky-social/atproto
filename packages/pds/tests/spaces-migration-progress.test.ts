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
import * as accountHelpers from '../src/account-manager/helpers/account.js'
import { events } from '../src/events.js'
import {
  SpacesMigrationProgress,
  registerSpacesMigration,
  statsAdjustment,
  unparkSpacesMigration,
} from '../src/spaces-migration/progress.js'

const zero = {
  total: 0,
  storesMigrated: 0,
  keysPublished: 0,
  unpublishable: 0,
  deactivated: 0,
  failing: 0,
  sweepFailing: 0,
}

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

  describe('recount', () => {
    const now = currentDatetimeString()

    it('counts each row by its own columns', async () => {
      await addAccount({ row: { storeMigratedAt: now, kemPublishedAt: now } })
      await addAccount({ row: { storeMigratedAt: now, kemPublishedAt: now } })
      await addAccount({ row: { unpublishableReason: 'did-web' } })
      // Deactivated means parked, whatever the actor row says
      await addAccount({ row: { nextAttemptAt: null } })
      await addAccount({ deactivated: true })
      await addAccount({ row: { attempts: 2 } })
      await addAccount({ row: { sweepAttempts: 1 } })
      await addAccount()
      expect(await progress.recount()).toEqual({
        total: 8,
        storesMigrated: 2,
        keysPublished: 2,
        unpublishable: 1,
        deactivated: 1,
        failing: 1,
        sweepFailing: 1,
      })
    })

    it('counts an empty table', async () => {
      expect(await progress.recount()).toEqual(zero)
    })
  })

  describe('stats', () => {
    const owner = 'owner'
    const nowMs = () => Date.now()

    const addActor = async (did: DidString, deactivated = false) => {
      await db.db
        .insertInto('actor')
        .values({
          did,
          handle: null,
          createdAt: currentDatetimeString(),
          deactivatedAt: deactivated ? currentDatetimeString() : null,
        })
        .execute()
    }

    it('start at zero', async () => {
      expect(await progress.summary()).toEqual(zero)
    })

    it('follow each tracked write', async () => {
      const did = `did:plc:stats${counter++}` as DidString
      await addActor(did)
      await registerSpacesMigration(db, did, { kemPublished: false })
      expect(await progress.summary()).toMatchObject({
        total: 1,
        storesMigrated: 1,
        keysPublished: 0,
      })
      await progress.claimDue(owner, nowMs(), 1, 60_000, 0)
      await progress.recordFailure(did, owner, new Error('x'), nowMs())
      expect((await progress.summary()).failing).toBe(1)
      await progress.claimDue(owner, nowMs() + 1, 1, 60_000, 0)
      await progress.recordPublished(did, owner)
      expect(await progress.summary()).toMatchObject({
        keysPublished: 1,
        failing: 0,
      })
      await accountHelpers.deleteAccount(db, did)
      expect(await progress.summary()).toEqual(zero)
    })

    it('leave claims and lease releases to one statement each', async () => {
      const did = `did:plc:stats${counter++}` as DidString
      await addActor(did)
      await progress.seed()
      using transaction = jest.spyOn(db, 'transaction')
      await progress.claimDue(owner, nowMs(), 1, 60_000, 0)
      await progress.release(did, owner)
      await progress.claimUnswept(owner, nowMs(), 1, 60_000)
      expect(transaction).not.toHaveBeenCalled()
    })

    it('adjust by primary key, never scanning', async () => {
      const did = `did:plc:stats${counter++}` as DidString
      const { sql: text, parameters } = statsAdjustment([did], 1).compile(db.db)
      const { rows } = await db.db.executeQuery<{ detail: string }>(
        CompiledQuery.raw(`explain query plan ${text}`, [...parameters]),
      )
      const plan = rows.map((r) => r.detail).join('\n')
      expect(plan).toMatch(/SEARCH spaces_migration USING INDEX .*\(did=\?\)/)
      expect(plan).toMatch(
        /SEARCH spaces_migration_stats USING INTEGER PRIMARY KEY/,
      )
      expect(plan).not.toMatch(/\bSCAN spaces_migration\b/)
    })

    it('report drift without failing the write', async () => {
      const did = `did:plc:stats${counter++}` as DidString
      await addActor(did)
      // A row written around the stats: deleting it drives total negative
      await db.db.insertInto('spaces_migration').values({ did }).execute()
      using drift = jest.spyOn(events, 'spacesMigrationStatsDrift')
      await accountHelpers.deleteAccount(db, did)
      expect(drift).toHaveBeenCalledTimes(1)
      expect(await progress.get(did)).toBeUndefined()
    })

    it.each([42, 7, 2026])(
      'match a recount through any sequence of writes (seed %i)',
      async (seed) => {
        // Deterministic, so a failure reproduces
        const random = (n: number) => {
          seed = (seed * 1103515245 + 12345) % 2 ** 31
          return seed % n
        }
        const dids = Array.from(
          { length: 6 },
          () => `did:plc:prop${counter++}` as DidString,
        )
        for (const did of dids) await addActor(did, random(3) === 0)
        const later = () => nowMs() + 60_000
        // Lease-only transitions need a leased account, and unparking a
        // parked one: aim at the latest of each most of the time
        let claimed: DidString[] = []
        const parked: DidString[] = []
        const target = (name: string) => {
          const pool = name === 'unpark' ? parked : claimed
          return pool.length > 0 && random(4) > 0
            ? pool[random(pool.length)]
            : dids[random(dids.length)]
        }

        const ops: Record<string, (did: DidString) => Promise<unknown>> = {
          register: (did) =>
            registerSpacesMigration(db, did, {
              kemPublished: random(2) === 0,
            }),
          seed: () => progress.seed(),
          claim: async () => {
            const got = await progress.claimDue(
              owner,
              nowMs(),
              3,
              60_000,
              random(2) as 0 | 1,
            )
            if (got.length > 0) claimed = got
          },
          claimUnswept: async () => {
            const got = await progress.claimUnswept(owner, nowMs(), 3, 60_000)
            if (got.length > 0) claimed = got
          },
          publish: (did) => progress.recordPublished(did, owner),
          unpublishable: (did) =>
            progress.recordUnpublishable(did, owner, 'did-web'),
          fail: (did) => progress.recordFailure(did, owner, 'x', later()),
          release: (did) => progress.release(did, owner),
          park: async (did) => {
            if (await progress.parkIfDeactivated(did, owner)) parked.push(did)
          },
          unpark: (did) => unparkSpacesMigration(db, did),
          swept: (did) => progress.recordSwept(did, owner),
          sweepFail: (did) =>
            progress.recordSweepFailure(did, owner, 'x', later()),
          removeSwept: (did) => progress.removeSwept(did, owner),
          remove: (did) => progress.remove(did, owner),
          bump: (did) => progress.bump(did),
          check: (did) =>
            progress.recordChecked(did, {
              published: random(2) === 0,
              unpublishableReason: random(3) === 0 ? 'did-web' : null,
            }),
          deleteAccount: async (did) => {
            await accountHelpers.deleteAccount(db, did)
            // Back for later steps, perhaps deactivated
            await addActor(did, random(2) === 0)
          },
        }
        const names = Object.keys(ops)
        for (let step = 0; step < 1500; step++) {
          const name = names[random(names.length)]
          await ops[name](target(name))
          expect({ step, name, stats: await progress.summary() }).toEqual({
            step,
            name,
            stats: await progress.recount(),
          })
        }
      },
    )
  })
})
