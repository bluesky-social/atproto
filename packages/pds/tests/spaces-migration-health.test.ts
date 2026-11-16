import { jest } from '@jest/globals'
import { metrics } from '@opentelemetry/api'
import { wait } from '@atproto/common'
import type { TestPds, TestPlc } from '@atproto/dev-env'
import type { DidString } from '@atproto/syntax'
import type { AccountDb } from '../src/account-manager/db/index.js'
import type { AppContext } from '../src/context.js'
import type { SpacesMigrationProgress } from '../src/spaces-migration/progress.js'
import type { SpacesMigrationPublisher } from '../src/spaces-migration/publisher.js'
import type { SpacesMigrationSummaryCache } from '../src/spaces-migration/summary-cache.js'
import type { SpacesMigrationSweep } from '../src/spaces-migration/sweep.js'

type Counts = Record<string, { value: number; attrs: unknown }[]>

// Records counter increments, for a meter provider that exports nowhere.
// Installed before the PDS module loads, which creates its counters.
const counts: Counts = {}
const noopInstrument = { add() {}, record() {}, addCallback() {} }
metrics.setGlobalMeterProvider({
  getMeter: (name: string) =>
    new Proxy(
      {
        createCounter: (counter: string) => ({
          add: (value: number, attrs?: unknown) => {
            if (name === '@atproto/pds') {
              ;(counts[counter] ??= []).push({ value, attrs })
            }
          },
        }),
      } as any,
      // Other packages create other instruments from their meters
      { get: (target, key) => target[key] ?? (() => noopInstrument) },
    ),
})

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
  let Publisher: typeof SpacesMigrationPublisher
  let Sweep: typeof SpacesMigrationSweep
  let SummaryCache: typeof SpacesMigrationSummaryCache

  beforeAll(async () => {
    // Loaded now, after the meter provider is installed: the workers create
    // their counters when their module loads
    ;({ SpacesMigrationPublisher: Publisher } =
      await import('../src/spaces-migration/publisher.js'))
    ;({ SpacesMigrationSweep: Sweep } =
      await import('../src/spaces-migration/sweep.js'))
    ;({ SpacesMigrationSummaryCache: SummaryCache } =
      await import('../src/spaces-migration/summary-cache.js'))
    const { SpacesMigrationProgress } =
      await import('../src/spaces-migration/progress.js')
    const { TestPds, TestPlc } = await import('@atproto/dev-env')
    plcServer = await TestPlc.create({})
    pds = await TestPds.create({
      didPlcUrl: plcServer.url,
      spacesMigrationDisabled: true,
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
    const dids: DidString[] = []
    for (let n = 0; n < 2; n++) {
      const res = await pds.getAgent().com.atproto.server.createAccount({
        email: `health${n}@test.com`,
        handle: `health${n}.test`,
        password: 'hunter2',
      })
      dids.push(res.data.did as DidString)
    }
    // As left by the release before spaces: nothing migrated or published
    await db.db
      .updateTable('spaces_migration')
      .set({ storeMigratedAt: null, kemPublishedAt: null })
      .execute()
    await ctx.spacesMigration.summaryCache.refresh()
    const before = await health()
    expect(before.spacesMigration).toMatchObject({
      total: 2,
      storesMigrated: 0,
      keysPublished: 0,
    })

    const onRecorded = () => ctx.spacesMigration.summaryCache.refreshSoon()
    const opts = {
      disabled: false,
      publishIntervalMs: 0,
      jitterWindowMs: 0,
      sweepIntervalMs: 0,
      pollIntervalMs: 20,
    }
    await using sweep = new Sweep(ctx, progress, opts, onRecorded)
    await using publisher = new Publisher(ctx, progress, opts, onRecorded)
    sweep.start()
    publisher.start()

    // Refreshed after the transitions, without waiting for the interval
    await waitFor(async () => {
      const { spacesMigration } = await health()
      return spacesMigration.keysPublished === 2
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
        failing: 0,
        sweepFailing: 0,
      },
    })

    expect(counts['spaces_migration.store_migrated']?.length).toBe(2)
    expect(counts['spaces_migration.kem_published']?.length).toBe(2)
  })

  describe('summary cache', () => {
    const summary = {
      total: 1,
      storesMigrated: 1,
      keysPublished: 1,
      unpublishable: 0,
      failing: 0,
      sweepFailing: 0,
    }

    it('has no summary until the first refresh', async () => {
      const cache = new SummaryCache({
        summary: async () => summary,
      })
      expect(cache.latest).toBeUndefined()
      await cache.refresh()
      expect(cache.latest).toEqual(summary)
    })

    it('keeps the last summary when a refresh fails', async () => {
      let fail = false
      const cache = new SummaryCache({
        summary: async () => {
          if (fail) throw new Error('db down')
          return summary
        },
      })
      await cache.refresh()
      fail = true
      await expect(cache.refresh()).resolves.toBeUndefined()
      expect(cache.latest).toEqual(summary)
    })

    it('coalesces a burst of transitions into one query', async () => {
      const query = jest.fn(async () => summary)
      const cache = new SummaryCache(
        { summary: query },
        { intervalMs: 60_000, debounceMs: 20 },
      )
      cache.start()
      try {
        await waitFor(async () => cache.latest !== undefined)
        query.mockClear()
        for (let i = 0; i < 20; i++) cache.refreshSoon()
        await wait(150)
        expect(query).toHaveBeenCalledTimes(1)
      } finally {
        await cache.destroy()
      }
    })

    it('stops refreshing once destroyed', async () => {
      const query = jest.fn(async () => summary)
      const cache = new SummaryCache(
        { summary: query },
        { intervalMs: 10, debounceMs: 0 },
      )
      cache.start()
      await waitFor(async () => query.mock.calls.length > 1)
      await cache.destroy()
      const calls = query.mock.calls.length
      await wait(50)
      expect(query).toHaveBeenCalledTimes(calls)
    })
  })
})
