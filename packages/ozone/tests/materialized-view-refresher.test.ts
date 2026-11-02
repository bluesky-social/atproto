import { jest } from '@jest/globals'
import { TestNetwork } from '@atproto/dev-env'
import { MATERIALIZED_VIEW_REFRESH_LOCK_ID } from '../src/db/index.js'
import type { Database } from '../src/index.js'
import { dbLogger } from '../src/logger.js'

describe('materialized view refresher', () => {
  let network: TestNetwork
  let db: Database

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_view_refresher',
    })
    db = network.ozone.ctx.db
  })

  afterAll(async () => {
    await network?.close()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('skips the cycle while another session holds the lock', async () => {
    const contender = await db.pool.connect()
    try {
      await contender.query(
        `SELECT pg_advisory_lock(
          hashtextextended(current_database() || ':' || $2::text, $1)
        )`,
        [MATERIALIZED_VIEW_REFRESH_LOCK_ID, db.opts.schema ?? 'public'],
      )

      const infoSpy = jest.spyOn(dbLogger, 'info')

      await network.ozone.daemon.ctx.materializedViewRefresher.run()

      const messages = infoSpy.mock.calls.map(
        (call) => call.find((arg) => typeof arg === 'string') ?? '',
      )
      expect(messages).toContain(
        'lock is held - skipping materialized view refresh',
      )
      expect(
        messages.filter((msg) => msg === 'refreshed materialized view'),
      ).toHaveLength(0)
    } finally {
      await contender.query(
        `SELECT pg_advisory_unlock(
          hashtextextended(current_database() || ':' || $2::text, $1)
        )`,
        [MATERIALIZED_VIEW_REFRESH_LOCK_ID, db.opts.schema ?? 'public'],
      )
      contender.release()
    }
  })

  it('does not share the lock with another schema', async () => {
    const contender = await db.pool.connect()
    try {
      await contender.query(
        `SELECT pg_advisory_lock(
          hashtextextended(current_database() || ':' || $2::text, $1)
        )`,
        [MATERIALIZED_VIEW_REFRESH_LOCK_ID, 'ozone_view_refresher_contender'],
      )

      const infoSpy = jest.spyOn(dbLogger, 'info')

      await network.ozone.daemon.ctx.materializedViewRefresher.run()

      const refreshCalls = infoSpy.mock.calls.filter((call) =>
        call.includes('refreshed materialized view'),
      )
      expect(refreshCalls).toHaveLength(4)
    } finally {
      await contender.query(
        `SELECT pg_advisory_unlock(
          hashtextextended(current_database() || ':' || $2::text, $1)
        )`,
        [MATERIALIZED_VIEW_REFRESH_LOCK_ID, 'ozone_view_refresher_contender'],
      )
      contender.release()
    }
  })

  it('completes a cycle with per-view durations and releases the lock', async () => {
    const infoSpy = jest.spyOn(dbLogger, 'info')

    await network.ozone.daemon.ctx.materializedViewRefresher.run()

    const refreshCalls = infoSpy.mock.calls.filter((call) =>
      call.includes('refreshed materialized view'),
    )
    expect(refreshCalls).toHaveLength(4)
    const views = refreshCalls.map((call) => {
      const obj = call[0] as { view: string; durationMs: number }
      expect(typeof obj.durationMs).toBe('number')
      return obj.view
    })
    expect(views.sort()).toEqual([
      'account_events_stats',
      'account_record_events_stats',
      'account_record_status_stats',
      'record_events_stats',
    ])

    // The lock was released between cycles: a second run also succeeds.
    infoSpy.mockClear()
    await network.ozone.daemon.ctx.materializedViewRefresher.run()
    const secondRefreshCalls = infoSpy.mock.calls.filter((call) =>
      call.includes('refreshed materialized view'),
    )
    expect(secondRefreshCalls).toHaveLength(4)
  })

  it('logs a stable failure message, continues with remaining views, and releases the lock when one refresh fails', async () => {
    // Rename one view away so its refresh fails, the way a dropped or
    // re-owned view would in prod (the test connection may be a superuser,
    // so revoking ownership would not reliably fail).
    const admin = await db.pool.connect()
    let renamed = false
    try {
      await admin.query(
        'ALTER MATERIALIZED VIEW "record_events_stats" RENAME TO "record_events_stats_broken"',
      )
      renamed = true

      const infoSpy = jest.spyOn(dbLogger, 'info')
      const errorSpy = jest.spyOn(dbLogger, 'error')

      await network.ozone.daemon.ctx.materializedViewRefresher.run()

      // The failure log carries the stable alert-target message and shape.
      const failureCalls = errorSpy.mock.calls.filter((call) =>
        call.includes('failed to refresh materialized view'),
      )
      expect(failureCalls).toHaveLength(1)
      const failure = failureCalls[0][0] as {
        err: unknown
        view: string
        durationMs: number
      }
      expect(failure.err).toBeDefined()
      expect(failure.view).toBe('record_events_stats')
      expect(typeof failure.durationMs).toBe('number')

      // The remaining views still refreshed, including those ordered after
      // the failing one.
      const refreshedViews = infoSpy.mock.calls
        .filter((call) => call.includes('refreshed materialized view'))
        .map((call) => (call[0] as { view: string }).view)
      expect(refreshedViews.sort()).toEqual([
        'account_events_stats',
        'account_record_events_stats',
        'account_record_status_stats',
      ])

      // The advisory lock was released despite the failure.
      const lockResult = await admin.query(
        `SELECT pg_try_advisory_lock(
          hashtextextended(current_database() || ':' || $2::text, $1)
        ) as locked`,
        [MATERIALIZED_VIEW_REFRESH_LOCK_ID, db.opts.schema ?? 'public'],
      )
      expect(lockResult.rows[0]?.locked).toBe(true)
      await admin.query(
        `SELECT pg_advisory_unlock(
          hashtextextended(current_database() || ':' || $2::text, $1)
        )`,
        [MATERIALIZED_VIEW_REFRESH_LOCK_ID, db.opts.schema ?? 'public'],
      )
    } finally {
      if (renamed) {
        await admin.query(
          'ALTER MATERIALIZED VIEW "record_events_stats_broken" RENAME TO "record_events_stats"',
        )
      }
      admin.release()
    }
  })
})
