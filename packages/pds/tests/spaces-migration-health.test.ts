import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { wait } from '@atproto/common'
import { TestPds, TestPlc } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import { SpacesMigrationProgress as PdsSpacesMigrationProgress } from '../dist/spaces-migration/progress.js'
import type { AccountDb } from '../src/account-manager/db/index.js'
import type { AppContext } from '../src/context.js'
import { events } from '../src/events.js'
import {
  SpacesMigrationProgress,
  trackStats,
} from '../src/spaces-migration/progress.js'
import { SpacesMigrationPublisher } from '../src/spaces-migration/publisher.js'
import { SpacesMigrationSweep } from '../src/spaces-migration/sweep.js'

const waitFor = async (check: () => Promise<boolean>, timeoutMs = 10_000) => {
  const deadline = Date.now() + timeoutMs
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('timed out')
    await wait(20)
  }
}

describe('spaces migration health', () => {
  let plcServer: TestPlc
  let pds: TestPds
  let ctx: AppContext
  let db: AccountDb
  let progress: SpacesMigrationProgress

  beforeAll(async () => {
    plcServer = await TestPlc.create({})
    pds = await TestPds.create({
      didPlcUrl: plcServer.url,
      spacesMigration: 'disabled',
    })
    ctx = pds.ctx as unknown as AppContext
    db = ctx.accountManager.db
    progress = new SpacesMigrationProgress(db)
  })

  afterAll(async () => {
    await pds?.close()
    await plcServer?.close()
  })

  const health = async () => {
    const res = await fetch(`${pds.url}/xrpc/_health`)
    expect(res.status).toBe(200)
    return res.json() as Promise<any>
  }

  it('reports migration progress on the health endpoint', async () => {
    // @NOTE The workers below are built from src, so they report to src's
    // events (the PDS's own workers are disabled)
    using storeMigrated = vi.spyOn(events, 'spacesMigrationStoreMigrated')
    using kemPublished = vi.spyOn(events, 'spacesMigrationKemPublished')
    const dids: DidString[] = []
    for (let n = 0; n < 2; n++) {
      const res = await pds.getAgent().com.atproto.server.createAccount({
        email: `health${n}@test.com`,
        handle: `health${n}.test`,
        password: 'hunter2',
      })
      dids.push(res.data.did as DidString)
    }
    // As left by the release before spaces: neither settled nor seeded
    await trackStats(db, dids, async (txn) => {
      await txn.db
        .updateTable('actor')
        .set({ kemKeyState: null })
        .where('did', 'in', dids)
        .execute()
      await txn.db
        .deleteFrom('spaces_migration')
        .where('did', 'in', dids)
        .execute()
    })
    expect((await health()).spacesMigration).toMatchObject({ total: 0 })
    // Then seeded: nothing migrated or published
    expect(await progress.seed()).toBe(2)
    const before = await health()
    expect(before.spacesMigration).toMatchObject({
      total: 2,
      storesMigrated: 0,
      keysPublished: 0,
    })

    const opts = {
      state: 'enabled' as const,
      publishIntervalMs: 0,
      jitterWindowMs: 0,
      sweepIntervalMs: 0,
      pollIntervalMs: 20,
    }
    await using sweep = new SpacesMigrationSweep(ctx, progress, opts)
    await using publisher = new SpacesMigrationPublisher(ctx, progress, opts)
    sweep.start()
    publisher.start()

    // Kept up to date by the transitions themselves
    await waitFor(async () => {
      const { spacesMigration } = await health()
      return (
        spacesMigration.keysPublished === 2 &&
        spacesMigration.storesMigrated === 2
      )
    })
    expect(await health()).toEqual({
      version: expect.any(String),
      spacesMigration: {
        // The context's own publisher is disabled in this test
        publisher: 'disabled',
        total: 2,
        storesMigrated: 2,
        keysPublished: 2,
        unpublishable: 0,
        deactivated: 0,
        failing: 0,
        sweepFailing: 0,
      },
    })

    expect(storeMigrated).toHaveBeenCalledTimes(2)
    expect(kemPublished).toHaveBeenCalledTimes(2)
    // Settled: both finished accounts left the table
    for (const did of dids) {
      expect(await progress.recordedKemKeyState(did)).toBe('published')
    }
    expect(
      await db.db.selectFrom('spaces_migration').selectAll().execute(),
    ).toEqual([])
  })

  describe('once the migration is complete', () => {
    it('runs no workers and reports only the state', async () => {
      // @NOTE The PDS runs from dist, so spy on the class it uses rather than
      // on src's, which it never calls
      const { prototype } = PdsSpacesMigrationProgress
      using summary = vi.spyOn(prototype, 'summary')
      using seed = vi.spyOn(prototype, 'seed')
      const plc = await TestPlc.create({})
      const done = await TestPds.create({
        didPlcUrl: plc.url,
        spacesMigration: 'complete',
      })
      try {
        await wait(100)
        const res = await fetch(`${done.url}/xrpc/_health`)
        expect(await res.json()).toEqual({
          version: expect.any(String),
          spacesMigration: { publisher: 'complete' },
        })
        const doneCtx = done.ctx as unknown as AppContext
        expect(doneCtx.spacesMigration.sweep.state).toBe('complete')
        expect(summary).not.toHaveBeenCalled()
        expect(seed).not.toHaveBeenCalled()
      } finally {
        await done.close()
        await plc.close()
      }
    })
  })
})
