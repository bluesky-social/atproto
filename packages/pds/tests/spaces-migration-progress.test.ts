import { jest } from '@jest/globals'
import { type Compilable, CompiledQuery, sql } from 'kysely'
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
import type { ActorKemKeyState } from '../src/account-manager/db/schema/actor.js'
import * as accountHelpers from '../src/account-manager/helpers/account.js'
import { events } from '../src/events.js'
import {
  SpacesMigrationProgress,
  registerSpacesMigration,
  statsAdjustment,
  trackStats,
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

  it('adds an unknown kemKeyState to actors, indexed while unknown', async () => {
    const did = await addAccount()
    const actor = await db.db
      .selectFrom('actor')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirstOrThrow()
    expect(actor.kemKeyState).toBeNull()
    const { rows } = await db.db.executeQuery<{ detail: string }>(
      CompiledQuery.raw(
        'explain query plan select did from actor where kemKeyState is null order by did',
      ),
    )
    expect(rows.map((r) => r.detail).join('\n')).toMatch(
      /USING (COVERING )?INDEX actor_kem_key_state_unknown_idx/,
    )
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

  describe('settling', () => {
    const owner = 'owner'

    const state = async (did: DidString) => {
      const actor = await db.db
        .selectFrom('actor')
        .select('kemKeyState')
        .where('did', '=', did)
        .executeTakeFirstOrThrow()
      return actor.kemKeyState
    }

    const rowOf = (did: DidString) => progress.get(did)

    // An actor without a row or state, as a pre-spaces process creates it
    const addUnseeded = async () => {
      const did = `did:plc:settle${counter++}` as DidString
      await db.db
        .insertInto('actor')
        .values({
          did,
          handle: null,
          createdAt: currentDatetimeString(),
          deactivatedAt: null,
        })
        .execute()
      return did
    }

    // An actor with a seeded row: store unswept, key pending
    const addSeeded = async () => {
      const did = await addUnseeded()
      await progress.seed()
      return did
    }

    const addSettled = async () => {
      const did = await addUnseeded()
      await registerSpacesMigration(db, did, { kemPublished: true })
      return did
    }

    const swept = async (did: DidString) => {
      expect(
        await progress.claimUnswept(owner, Date.now(), 10, 60_000),
      ).toContain(did)
      await progress.recordSwept(did, owner)
    }

    const claimKey = async (did: DidString) => {
      expect(
        await progress.claimDue(owner, Date.now(), 10, 60_000, 0),
      ).toContain(did)
    }

    const published = async (did: DidString) => {
      await claimKey(did)
      await progress.recordPublished(did, owner)
    }

    it('settles once the store is migrated and the key published, in either order', async () => {
      for (const [first, second] of [
        [swept, published],
        [published, swept],
      ]) {
        const did = await addSeeded()
        await first(did)
        expect(await rowOf(did)).toBeDefined()
        expect(await state(did)).toBeNull()
        await second(did)
        expect(await rowOf(did)).toBeUndefined()
        expect(await state(did)).toBe('published')
      }
      expect(await progress.summary()).toEqual(await progress.recount())
    })

    it('settles permanently unpublishable keys', async () => {
      for (const reason of ['did-web', 'tombstoned'] as const) {
        const did = await addSeeded()
        await claimKey(did)
        await progress.recordUnpublishable(did, owner, reason)
        await swept(did)
        expect(await rowOf(did)).toBeUndefined()
        expect(await state(did)).toBe(reason)
      }
      expect(await progress.summary()).toEqual(await progress.recount())
    })

    it('keeps reasons that may change in the table', async () => {
      for (const reason of [
        'rotation-key-not-held',
        'signing-key-not-held',
      ] as const) {
        const did = await addSeeded()
        await claimKey(did)
        await progress.recordUnpublishable(did, owner, reason)
        await swept(did)
        expect(await rowOf(did)).toMatchObject({ unpublishableReason: reason })
        expect(await state(did)).toBeNull()
      }
    })

    it('re-queues a settled account when a check disagrees', async () => {
      const did = await addSettled()
      expect(await state(did)).toBe('published')
      await progress.recordChecked(did, {
        published: false,
        unpublishableReason: null,
        storeMigrated: true,
      })
      expect(await state(did)).toBeNull()
      const requeued = await rowOf(did)
      expect(requeued?.kemPublishedAt).toBeNull()
      expect(requeued?.nextAttemptAt).not.toBeNull()
      expect((requeued?.nextAttemptAt ?? '') <= currentDatetimeString()).toBe(
        true,
      )
      expect(await progress.recordedKemKeyState(did)).toBe('pending')
      expect(await progress.summary()).toEqual(await progress.recount())
    })

    it('keeps a settled account store migrated when a check re-queues it', async () => {
      const did = await addSettled()
      await progress.recordChecked(did, {
        published: false,
        unpublishableReason: null,
        storeMigrated: false,
      })
      expect(await state(did)).toBeNull()
      expect((await rowOf(did))?.storeMigratedAt).not.toBeNull()
      expect(await progress.summary()).toEqual(await progress.recount())
    })

    it('settles from a check once the store is migrated', async () => {
      const did = await addSeeded()
      expect((await rowOf(did))?.storeMigratedAt).toBeNull()
      await progress.recordChecked(did, {
        published: true,
        unpublishableReason: null,
        storeMigrated: true,
      })
      expect(await rowOf(did)).toBeUndefined()
      expect(await state(did)).toBe('published')
      expect(await progress.recordedKemKeyState(did)).toBe('published')
      expect(await progress.summary()).toEqual(await progress.recount())
    })

    it('keeps a checked row until the store is migrated', async () => {
      const did = await addSeeded()
      await progress.recordChecked(did, {
        published: true,
        unpublishableReason: null,
        storeMigrated: false,
      })
      expect(await rowOf(did)).toMatchObject({ storeMigratedAt: null })
      expect(await progress.recordedKemKeyState(did)).toBe('published')
      expect(await state(did)).toBeNull()
    })

    it('records the state of a row, and none for an unknown account', async () => {
      const did = await addSeeded()
      expect(await progress.recordedKemKeyState(did)).toBe('pending')
      await claimKey(did)
      await progress.recordUnpublishable(did, owner, 'signing-key-not-held')
      expect(await progress.recordedKemKeyState(did)).toBe(
        'signing-key-not-held',
      )
      expect(
        await progress.recordedKemKeyState('did:plc:settlenone' as DidString),
      ).toBeUndefined()
    })

    it('registers an account born published without a row', async () => {
      const did = await addUnseeded()
      // As left by an earlier account with this DID
      await trackStats(db, [did], (txn) =>
        txn.db
          .insertInto('spaces_migration')
          .values({ did, attempts: 3 })
          .execute(),
      )
      await registerSpacesMigration(db, did, { kemPublished: true })
      expect(await rowOf(did)).toBeUndefined()
      expect(await state(did)).toBe('published')
      expect(await progress.summary()).toEqual(await progress.recount())
    })

    it('registers an account born without a published key with a row', async () => {
      const did = await addUnseeded()
      await registerSpacesMigration(db, did, { kemPublished: false })
      const registered = await rowOf(did)
      expect(registered?.storeMigratedAt).not.toBeNull()
      expect(registered?.kemPublishedAt).toBeNull()
      expect(await state(did)).toBeNull()
    })

    it('seeds only unsettled actors', async () => {
      const settled = await addSettled()
      const unseeded = await addUnseeded()
      expect(await progress.seed()).toBe(1)
      expect(await rowOf(settled)).toBeUndefined()
      expect(await rowOf(unseeded)).toBeDefined()
      expect(await progress.summary()).toEqual(await progress.recount())
    })

    it('never brings back a settled account, even from a stale batch', async () => {
      const did = await addSettled()
      expect(await progress.seedBatch([did])).toBe(0)
      expect(await rowOf(did)).toBeUndefined()
      expect(await state(did)).toBe('published')
      expect(await progress.summary()).toEqual(await progress.recount())
    })

    it('seeds only rows not already there, page by page', async () => {
      const seeded = await addSeeded()
      // More than a page of unseeded actors
      const dids = Array.from(
        { length: 1001 },
        (_, i) =>
          `did:plc:settlepage${String(i).padStart(4, '0')}` as DidString,
      )
      await db.db
        .insertInto('actor')
        .values(
          dids.map((did) => ({
            did,
            handle: null,
            createdAt: currentDatetimeString(),
            deactivatedAt: null,
          })),
        )
        .execute()
      expect(await progress.seed()).toBe(1001)
      expect(await rowOf(seeded)).toBeDefined()
      expect(await rowOf(dids[1000])).toBeDefined()
      expect(await progress.seed()).toBe(0)
      expect(await progress.summary()).toEqual(await progress.recount())
    })

    it('seeds through the unknown-state index, a bounded page at a time', async () => {
      // The candidate queries of a first page and of the page after it
      const queries: Compilable[] = []
      const pages = [[{ did: 'did:plc:settlecursor' }], []]
      using _query = jest
        .spyOn(db, 'executeWithRetry')
        .mockImplementation(async (query) => {
          queries.push(query as unknown as Compilable)
          return pages.shift() ?? []
        })
      using _batch = jest.spyOn(progress, 'seedBatch').mockResolvedValue(0)
      await progress.seed()
      expect(queries).toHaveLength(2)
      for (const query of queries) {
        const { sql: text, parameters } = query.compile()
        expect(text).toMatch(/ limit \?$/)
        const { rows } = await db.db.executeQuery<{ detail: string }>(
          CompiledQuery.raw(`explain query plan ${text}`, [...parameters]),
        )
        const plan = rows.map((r) => r.detail).join('\n')
        expect(plan).toMatch(
          /(SCAN|SEARCH) actor USING (COVERING )?INDEX actor_kem_key_state_unknown_idx/,
        )
        // Nothing per candidate: rows that exist are skipped by the insert
        expect(plan).not.toMatch(/spaces_migration|TEMP B-TREE/)
      }
      expect(queries[1].compile().sql).toMatch(/"did" > \?/)
    })

    it('bumps only accounts with a row', async () => {
      const settled = await addSettled()
      const noActor = `did:plc:settle${counter++}` as DidString
      for (const did of [settled, noActor]) {
        await progress.bump(did)
        expect(await rowOf(did)).toBeUndefined()
      }
      expect(await progress.summary()).toEqual(await progress.recount())
      const seeded = await addSeeded()
      await progress.bump(seeded)
      expect(await rowOf(seeded)).toMatchObject({ priority: 1 })
    })

    it('refuses to register an account without an actor', async () => {
      const did = `did:plc:settle${counter++}` as DidString
      for (const kemPublished of [true, false]) {
        await expect(
          registerSpacesMigration(db, did, { kemPublished }),
        ).rejects.toThrow('No actor')
      }
      expect(await rowOf(did)).toBeUndefined()
      expect(await progress.summary()).toEqual(zero)
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

    const settle = async (did: DidString, kemKeyState: ActorKemKeyState) => {
      await trackStats(db, [did], (txn) =>
        txn.db
          .insertInto('actor')
          .values({
            did,
            handle: null,
            createdAt: currentDatetimeString(),
            deactivatedAt: null,
            kemKeyState,
          })
          .execute(),
      )
    }

    it('count a settled actor', async () => {
      const published = `did:plc:stats${counter++}` as DidString
      await settle(published, 'published')
      const expected = {
        ...zero,
        total: 1,
        storesMigrated: 1,
        keysPublished: 1,
      }
      expect(await progress.summary()).toEqual(expected)
      expect(await progress.recount()).toEqual(expected)
      await accountHelpers.deleteAccount(db, published)
      const didWeb = `did:plc:stats${counter++}` as DidString
      await settle(didWeb, 'did-web')
      const unpublishable = {
        ...zero,
        total: 1,
        storesMigrated: 1,
        unpublishable: 1,
      }
      expect(await progress.summary()).toEqual(unpublishable)
      expect(await progress.recount()).toEqual(unpublishable)
    })

    it('count nothing for an unseeded actor', async () => {
      await addActor(`did:plc:stats${counter++}` as DidString)
      expect(await progress.recount()).toEqual(zero)
    })

    it('follow account deletion of a settled account', async () => {
      const did = `did:plc:stats${counter++}` as DidString
      await settle(did, 'published')
      using drift = jest.spyOn(events, 'spacesMigrationStatsDrift')
      await accountHelpers.deleteAccount(db, did)
      expect(await progress.summary()).toEqual(zero)
      expect(drift).not.toHaveBeenCalled()
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
      expect(plan).toMatch(/SEARCH actor USING .*\(did=\?\)/)
      expect(plan).not.toMatch(/\bSCAN actor\b/)
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
              storeMigrated: random(2) === 0,
            }),
          // A candidate list captured before some of its accounts settled
          staleSeed: () =>
            progress.seedBatch(dids.filter(() => random(2) === 0)),
          olderVersionCreate: async () => {
            // No row and no state, written around the stats
            const did = `did:plc:prop${counter++}` as DidString
            await addActor(did, random(3) === 0)
            dids.push(did)
          },
          deleteAccount: async (did) => {
            await accountHelpers.deleteAccount(db, did)
            // Back for later steps, perhaps deactivated
            await addActor(did, random(2) === 0)
          },
        }
        // Accounts with both a row and a settled state: always none
        const withRowAndState = async () => {
          const { rows } = await sql<{ n: number }>`
            select count(*) as n from actor join spaces_migration using (did)
            where actor."kemKeyState" is not null
          `.execute(db.db)
          return Number(rows[0].n)
        }
        // Rows that settle() should have moved to the actor: always none
        const finalRows = async () => {
          const { rows } = await sql<{ n: number }>`
            select count(*) as n from spaces_migration
            where "storeMigratedAt" is not null
              and ("kemPublishedAt" is not null
                or "unpublishableReason" in ('did-web', 'tombstoned'))
          `.execute(db.db)
          return Number(rows[0].n)
        }
        const names = Object.keys(ops)
        for (let step = 0; step < 1500; step++) {
          const name = names[random(names.length)]
          await ops[name](target(name))
          expect({
            step,
            name,
            stats: await progress.summary(),
            both: await withRowAndState(),
            final: await finalRows(),
          }).toEqual({
            step,
            name,
            stats: await progress.recount(),
            both: 0,
            final: 0,
          })
        }
      },
    )
  })
})
