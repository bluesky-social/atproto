import { rm } from 'node:fs/promises'
import { jest } from '@jest/globals'
import SqliteDB from 'better-sqlite3'
import { wait } from '@atproto/common'
import { TestPds, TestPlc } from '@atproto/dev-env'
import { type DidString, currentDatetimeString } from '@atproto/syntax'
import type { AccountDb } from '../src/account-manager/db/index.js'
import type { AppContext } from '../src/context.js'
import { SpacesMigrationProgress } from '../src/spaces-migration/progress.js'
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
        spacesMigrationDisabled: true,
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
      disabled: false,
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
  const isSwept = async (did: string) =>
    (await row(did))?.storeMigratedAt != null

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

  // An account as left by the release before spaces: a store behind the
  // latest migration, no kem key, and a row that isn't marked swept.
  const createPreSpacesAccount = async () => {
    const did = await createAccount()
    await withFile(did, (file) => {
      for (const table of SPACE_TABLES) file.exec(`drop table "${table}"`)
      file.prepare('delete from kysely_migration where name = ?').run('002')
    })
    const { kemKeyLocation } = await ctx.actorStore.getLocation(did)
    await rm(kemKeyLocation, { force: true })
    await db.db
      .updateTable('spaces_migration')
      .set({ storeMigratedAt: null })
      .where('did', '=', did)
      .execute()
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
    await db.db.deleteFrom('spaces_migration').where('did', '=', did).execute()

    // The publisher may have looked for work before the rows existed
    const onSeeded = jest.fn()
    await using s = new SpacesMigrationSweep(
      ctx,
      progress,
      { disabled: false, sweepIntervalMs: 0, pollIntervalMs: 20 },
      () => {},
      onSeeded,
    )
    s.start()
    await waitFor(() => isSwept(did))
    expect(await row(did)).toMatchObject({ kemPublishedAt: null })
    expect(onSeeded).toHaveBeenCalledTimes(1)
  })

  it('removes the row of an account whose store is gone', async () => {
    const did = await createPreSpacesAccount()
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
    expect(failed?.sweepNextAttemptAt).toBeGreaterThan(Date.now())
    expect((await progress.summary()).sweepFailing).toBe(before + 1)

    // Not retried before its time
    await wait(150)
    expect(ensure).toHaveBeenCalledTimes(1)
    expect(await isSwept(did)).toBe(false)

    // Once the time comes, it succeeds and the failure is cleared
    await db.db
      .updateTable('spaces_migration')
      .set({ sweepNextAttemptAt: 0 })
      .where('did', '=', did)
      .execute()
    await waitFor(() => isSwept(did))
    const swept = await row(did)
    expect(swept?.sweepAttempts).toBe(0)
    expect(swept?.sweepLastError).toBeNull()
    expect((await progress.summary()).sweepFailing).toBe(before)
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
    // Runs alongside the publisher's, so both fit Docker's default grace
    expect(setTimeoutSpy.mock.calls.map(([, ms]) => ms)).toContain(5_000)
  })

  it('does nothing when disabled', async () => {
    const did = await createPreSpacesAccount()
    await using s = sweep({ disabled: true })
    await wait(100)
    expect(s.state).toBe('disabled')
    expect(await isSwept(did)).toBe(false)
    // leave nothing behind for other tests
    await db.db
      .updateTable('spaces_migration')
      .set({ storeMigratedAt: currentDatetimeString() })
      .where('did', '=', did)
      .execute()
  })

  describe('space authorization', () => {
    // The hook the provider calls before it answers an authorization
    const authorize = async (did: DidString, scope: string) => {
      const provider = ctx.oauthProvider as unknown as {
        hooks: { onAuthorized: (data: unknown) => Promise<void> }
      }
      await provider.hooks.onAuthorized({
        account: { did },
        client: { id: 'https://client.example/meta.json' },
        parameters: { scope },
      })
    }

    it('bumps an account that authorizes with space access', async () => {
      const did = await createAccount()
      expect((await row(did))?.priority).toBe(0)
      using wake = jest.spyOn(ctx.spacesMigration.publisher, 'wake')

      await authorize(did, 'atproto space:foo')

      expect((await row(did))?.priority).toBe(1)
      expect(wake).toHaveBeenCalledTimes(1)
    })

    it('leaves an account that authorizes without space access', async () => {
      const did = await createAccount()
      using wake = jest.spyOn(ctx.spacesMigration.publisher, 'wake')

      await authorize(did, 'atproto')

      expect((await row(did))?.priority).toBe(0)
      expect(wake).not.toHaveBeenCalled()
    })

    it('authorization succeeds when the bump fails', async () => {
      const did = await createAccount()
      using bump = jest
        .spyOn(ctx.spacesMigration.progress, 'bump')
        .mockRejectedValue(new Error('db down'))

      await expect(authorize(did, 'atproto space:foo')).resolves.toBeUndefined()
      expect(bump).toHaveBeenCalledTimes(1)
    })
  })
})
