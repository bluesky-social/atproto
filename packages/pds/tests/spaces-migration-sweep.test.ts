import { rm } from 'node:fs/promises'
import { jest } from '@jest/globals'
import SqliteDB from 'better-sqlite3'
import { wait } from '@atproto/common'
import { P256Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import {
  type DidString,
  type HandleString,
  currentDatetimeString,
} from '@atproto/syntax'
import type { AccountDb } from '../src/account-manager/db/index.js'
import type { AppContext } from '../src/context.js'
import { internal } from '../src/lexicons/index.js'
import {
  SpacesMigrationProgress,
  trackStats,
} from '../src/spaces-migration/progress.js'
import {
  SpacesMigrationSweep,
  type SpacesMigrationSweepOptions,
} from '../src/spaces-migration/sweep.js'

const SPACE_TABLES = [
  'space',
  'memberspace_member',
  'space_policy',
  'space_record',
  'space_record_blob',
  'space_repo',
  'space_record_oplog',
  'space_writer',
  'space_notify_registration',
]

describe('spaces migration sweep', () => {
  let plcServer: TestPlc
  let pds: TestPds
  let ctx: AppContext
  let db: AccountDb
  let progress: SpacesMigrationProgress

  beforeAll(async () => {
    plcServer = await TestPlc.create({})
    pds = await TestPds.create(
      {
        didPlcUrl: plcServer.url,
        // Only the workers under test may run
        spacesMigration: 'disabled',
      },
      { grantsSpaceAccess: (scope) => scope.includes('space') },
    )
    ctx = pds.ctx as unknown as AppContext
    db = ctx.accountManager.db
    progress = new SpacesMigrationProgress(db)
  })

  afterAll(async () => {
    await pds?.close()
    await plcServer?.close()
  })

  const sweep = (opts: Partial<SpacesMigrationSweepOptions> = {}) => {
    const sweep = new SpacesMigrationSweep(ctx, progress, {
      state: 'enabled',
      sweepIntervalMs: 0,
      pollIntervalMs: 20,
      ...opts,
    })
    sweep.start()
    return sweep
  }

  const waitFor = async (check: () => Promise<boolean>, timeoutMs = 10_000) => {
    const deadline = Date.now() + timeoutMs
    while (!(await check())) {
      if (Date.now() > deadline) throw new Error('timed out')
      await wait(20)
    }
  }

  const row = (did: string) => progress.get(did as DidString)
  const recorded = (did: string) =>
    progress.recordedKemKeyState(did as DidString)
  const isSwept = async (did: string) => {
    // Settled: its store is migrated, and it has no row
    const actor = await db.db
      .selectFrom('actor')
      .select('kemKeyState')
      .where('did', '=', did as DidString)
      .executeTakeFirst()
    if (actor?.kemKeyState) return true
    return (await row(did))?.storeMigratedAt != null
  }

  let counter = 0
  const createAccount = async () => {
    const n = counter++
    const res = await pds.getAgent().com.atproto.server.createAccount({
      email: `sweep${n}@test.com`,
      handle: `sweep${n}.test`,
      password: 'hunter2',
    })
    return res.data.did as DidString
  }

  const withFile = async <T>(did: string, fn: (db: SqliteDB.Database) => T) => {
    const { dbLocation } = await ctx.actorStore.getLocation(did)
    const file = new SqliteDB(dbLocation)
    try {
      return fn(file)
    } finally {
      file.close()
    }
  }

  const migrations = (did: string) =>
    withFile(did, (file) =>
      file
        .prepare('select name from kysely_migration')
        .all()
        .map((r) => (r as { name: string }).name),
    )

  // An account as left by an older version: neither a settled state nor a
  // row, until the sweep seeds one.
  const createUnseededAccount = async () => {
    const did = await createAccount()
    await trackStats(db, [did], async (txn) => {
      await txn.db
        .updateTable('actor')
        .set({ kemKeyState: null })
        .where('did', '=', did)
        .execute()
      await txn.db
        .deleteFrom('spaces_migration')
        .where('did', '=', did)
        .execute()
    })
    return did
  }

  // An account as left by the release before spaces: unseeded, with a store
  // behind the latest migration and no kem key.
  const createPreSpacesAccount = async () => {
    const did = await createUnseededAccount()
    await withFile(did, (file) => {
      for (const table of SPACE_TABLES) file.exec(`drop table "${table}"`)
      file.prepare('delete from kysely_migration where name = ?').run('002')
    })
    const { kemKeyLocation } = await ctx.actorStore.getLocation(did)
    await rm(kemKeyLocation, { force: true })
    return did
  }

  it('migrates every pre-spaces store and creates missing kem keys', async () => {
    const dids = [
      await createPreSpacesAccount(),
      await createPreSpacesAccount(),
      await createPreSpacesAccount(),
    ]
    for (const did of dids) {
      expect(await ctx.actorStore.kemKeypair(did)).toBeUndefined()
      expect(await migrations(did)).not.toContain('002')
    }

    await using _ = sweep()
    await waitFor(async () => {
      const swept = await Promise.all(dids.map(isSwept))
      return swept.every(Boolean)
    })

    for (const did of dids) {
      expect(await ctx.actorStore.kemKeypair(did)).toBeDefined()
      expect(await migrations(did)).toContain('002')
      expect((await row(did))?.sweepLeaseOwner).toBeNull()
    }
  })

  it('splits the sweep across two processes', async () => {
    const dids = [
      await createPreSpacesAccount(),
      await createPreSpacesAccount(),
      await createPreSpacesAccount(),
      await createPreSpacesAccount(),
    ]
    using read = jest.spyOn(ctx.actorStore, 'read')
    await using a = sweep({ owner: 'a' })
    await using b = sweep({ owner: 'b' })
    await waitFor(async () => {
      const swept = await Promise.all(dids.map(isSwept))
      return swept.every(Boolean)
    })
    // Let any duplicate work show itself
    await wait(100)

    for (const did of dids) {
      const opened = read.mock.calls.filter(([d]) => d === did)
      expect(opened).toHaveLength(1)
    }
    expect(a.owner).not.toEqual(b.owner)
  })

  it('seeds rows for accounts that have none', async () => {
    // As left by the release before spaces: no row at all
    const did = await createPreSpacesAccount()
    // Born settled: never seeded
    const settled = await createAccount()

    // The publisher may have looked for work before the rows existed
    const onSeeded = jest.fn()
    await using s = new SpacesMigrationSweep(
      ctx,
      progress,
      { state: 'enabled', sweepIntervalMs: 0, pollIntervalMs: 20 },
      onSeeded,
    )
    s.start()
    await waitFor(() => isSwept(did))
    expect(await row(did)).toMatchObject({ kemPublishedAt: null })
    expect(onSeeded).toHaveBeenCalledTimes(1)
    expect(await row(settled)).toBeUndefined()
    expect(await recorded(settled)).toBe('published')
  })

  it('removes the row of an account whose store is gone', async () => {
    const did = await createPreSpacesAccount()
    await progress.seedBatch([did])
    expect(await row(did)).toBeDefined()
    const { directory } = await ctx.actorStore.getLocation(did)
    await rm(directory, { recursive: true, force: true })

    await using _ = sweep()
    await waitFor(async () => (await row(did)) === undefined)
  })

  it('sweeps deactivated accounts', async () => {
    const did = await createPreSpacesAccount()
    await db.db
      .updateTable('actor')
      .set({ deactivatedAt: new Date().toISOString() })
      .where('did', '=', did)
      .execute()

    await using _ = sweep()
    await waitFor(() => isSwept(did))
    expect(await ctx.actorStore.kemKeypair(did)).toBeDefined()
  })

  it('keeps going after a step throws', async () => {
    const did = await createPreSpacesAccount()
    using claim = jest
      .spyOn(progress, 'claimUnswept')
      .mockRejectedValueOnce(new Error('db hiccup'))

    await using _ = sweep()
    await waitFor(() => isSwept(did))
    expect(claim.mock.calls.length).toBeGreaterThan(1)
  })

  it('records a failed sweep and backs off before retrying it', async () => {
    const did = await createPreSpacesAccount()
    using ensure = jest
      .spyOn(ctx.actorStore, 'ensureKemKeypair')
      .mockRejectedValueOnce(new Error('disk full'))
    const before = (await progress.summary()).sweepFailing

    await using _ = sweep()
    await waitFor(async () => (await row(did))?.sweepAttempts === 1)
    const failed = await row(did)
    expect(failed?.sweepLastError).toBe('disk full')
    expect(failed?.storeMigratedAt).toBeNull()
    expect(failed?.sweepLeaseOwner).toBeNull()
    expect(Date.parse(failed?.sweepNextAttemptAt ?? '')).toBeGreaterThan(
      Date.now(),
    )
    expect((await progress.summary()).sweepFailing).toBe(before + 1)

    // Not retried before its time
    await wait(150)
    expect(ensure).toHaveBeenCalledTimes(1)
    expect(await isSwept(did)).toBe(false)

    // Once the time comes, it succeeds and the failure is cleared
    await trackStats(db, [did], (txn) =>
      txn.db
        .updateTable('spaces_migration')
        .set({ sweepNextAttemptAt: currentDatetimeString() })
        .where('did', '=', did)
        .execute(),
    )
    await waitFor(() => isSwept(did))
    const swept = await row(did)
    expect(swept?.sweepAttempts).toBe(0)
    expect(swept?.sweepLastError).toBeNull()
    expect((await progress.summary()).sweepFailing).toBe(before)
  })

  it('leaves a checked store unrecorded until the sweep gives it a kem key', async () => {
    const did = 'did:web:sweepweb.test' as DidString
    const signingKey = await Secp256k1Keypair.create({ exportable: true })
    const kemKey = await P256Keypair.create({ exportable: true })
    await ctx.actorStore.create(did, signingKey, kemKey)
    const commit = await ctx.actorStore.transact(did, (txn) =>
      txn.repo.createRepo([]),
    )
    await ctx.accountManager.createAccount({
      did,
      handle: 'sweepweb.test' as HandleString,
      repoCid: commit.cid,
      repoRev: commit.rev,
    })
    // Never reached by the sweep: no kem key, though the store's schema is
    // at the latest (opening a store migrates it)
    await trackStats(db, [did], (txn) =>
      txn.db
        .updateTable('spaces_migration')
        .set({ storeMigratedAt: null })
        .where('did', '=', did)
        .execute(),
    )
    const { kemKeyLocation } = await ctx.actorStore.getLocation(did)
    await rm(kemKeyLocation)
    expect(await ctx.actorStore.isMigrated(did)).toBe(true)
    using _resolve = jest
      .spyOn(ctx.idResolver.did, 'resolve')
      .mockImplementation(async () => ({ '@context': [], id: did }))

    const checked = await new Client({ service: pds.url }).call(
      internal.pds.checkSpacesMigration,
      { did },
      { headers: pds.adminAuthHeaders() },
    )

    expect(checked).toMatchObject({
      storeMigrated: true,
      kemPublished: false,
      unpublishableReason: 'did-web',
      recordedKemKeyState: 'did-web',
    })
    expect(checked.kemKey).toBeUndefined()
    // Not settled: settling would leave it without a key for good
    expect(await row(did)).toMatchObject({
      storeMigratedAt: null,
      unpublishableReason: 'did-web',
    })
    expect(await isSwept(did)).toBe(false)

    await using _ = sweep()
    await waitFor(() => isSwept(did))
    expect(await ctx.actorStore.kemKeypair(did)).toBeDefined()
    expect(await row(did)).toBeUndefined()
    expect(await recorded(did)).toBe('did-web')
  })

  it('stops promptly on destroy', async () => {
    const s = sweep({ pollIntervalMs: 60_000 })
    await wait(50)
    const started = Date.now()
    await s.destroy()
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it('bounds shutdown within a 10s stop grace by default', async () => {
    const s = sweep({ pollIntervalMs: 60_000 })
    await waitFor(async () => s.state === 'idle')
    using setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout')
    await s.destroy()
    // Runs after or before the other worker's, so both fit Docker's default
    // grace with room for the rest of shutdown
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toContain(3_000)
  })

  it('does nothing when disabled', async () => {
    const did = await createPreSpacesAccount()
    await using s = sweep({ state: 'disabled' })
    await wait(100)
    expect(s.state).toBe('disabled')
    // Not even seeded
    expect(await row(did)).toBeUndefined()
    expect(await recorded(did)).toBeUndefined()
    // leave nothing behind for other tests
    await trackStats(db, [did], (txn) =>
      txn.db
        .updateTable('actor')
        .set({ kemKeyState: 'published' })
        .where('did', '=', did)
        .execute(),
    )
  })

  describe('space authorization', () => {
    // The hook the provider calls once it issues a token, with the token's
    // scope (permission sets expanded)
    const authorize = async (did: DidString, scope: string) => {
      const provider = ctx.oauthProvider as unknown as {
        hooks: { onTokenCreated: (data: unknown) => Promise<void> }
      }
      await provider.hooks.onTokenCreated({
        account: { did },
        client: { id: 'https://client.example/meta.json' },
        parameters: { scope: 'atproto include:com.example.perms' },
        scope,
      })
    }

    // An account still migrating: an older version's, seeded
    const createMigratingAccount = async () => {
      const did = await createUnseededAccount()
      await progress.seedBatch([did])
      return did
    }

    it('bumps an account that authorizes with space access', async () => {
      const did = await createMigratingAccount()
      expect((await row(did))?.priority).toBe(0)
      using bump = jest.spyOn(ctx.spacesMigration.progress, 'bump')

      // As expanded from a permission set
      await authorize(did, 'atproto space:foo')

      expect((await row(did))?.priority).toBe(1)
      expect(bump).toHaveBeenCalledTimes(1)
    })

    it('leaves an account that authorizes without space access', async () => {
      const did = await createMigratingAccount()
      using bump = jest.spyOn(ctx.spacesMigration.progress, 'bump')

      await authorize(did, 'atproto')

      expect((await row(did))?.priority).toBe(0)
      expect(bump).not.toHaveBeenCalled()
    })

    it('gives a settled account no row when bumping it', async () => {
      // Born settled: its key was published by its genesis op
      const did = await createAccount()
      const before = await progress.summary()
      using bump = jest.spyOn(ctx.spacesMigration.progress, 'bump')

      await authorize(did, 'atproto space:foo')

      expect(bump).toHaveBeenCalledTimes(1)
      expect(await row(did)).toBeUndefined()
      expect(await recorded(did)).toBe('published')
      expect(await progress.summary()).toEqual(before)
    })

    it('issuing the token succeeds when the bump fails', async () => {
      const did = await createAccount()
      using bump = jest
        .spyOn(ctx.spacesMigration.progress, 'bump')
        .mockRejectedValue(new Error('db down'))

      await expect(authorize(did, 'atproto space:foo')).resolves.toBeUndefined()
      expect(bump).toHaveBeenCalledTimes(1)
    })
  })
})
