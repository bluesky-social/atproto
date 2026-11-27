import { afterEach, describe, expect, it, vi } from 'vitest'
import { STATS_COMPUTER_LOCK_ID } from '../src/daemon/locks.js'
import { StatsComputer } from '../src/daemon/stats-computer.js'
import type { Database } from '../src/db/index.js'
import { dbLogger } from '../src/logger.js'

describe('stats computer', () => {
  const statsQuery = {
    select: vi.fn(() => statsQuery),
    where: vi.fn(() => statsQuery),
    executeTakeFirst: vi.fn(async () => ({ computedAt: null })),
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('holds and releases the schema-scoped lock on one session', async () => {
    const query = vi
      .fn<(...args: unknown[]) => Promise<{ rows: unknown[] }>>()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [{ unlocked: true }] })
    const release = vi.fn()
    const db = {
      pool: { connect: vi.fn(async () => ({ query, release })) },
      schema: 'ozone_stats_computer',
      db: { selectFrom: vi.fn(() => statsQuery) },
    } as unknown as Database
    const materializeAll = vi.fn(async () => ({ rowsWritten: 0 }))
    const computer = new StatsComputer(
      db,
      () => ({ materializeAll }) as never,
      15,
    )

    await (computer as any).materializeStats()

    expect(materializeAll).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledTimes(2)
    expect(query.mock.calls[0]?.[1]).toEqual([
      STATS_COMPUTER_LOCK_ID,
      'ozone_stats_computer',
    ])
    expect(query.mock.calls[1]?.[1]).toEqual([
      STATS_COMPUTER_LOCK_ID,
      'ozone_stats_computer',
    ])
    expect(release).toHaveBeenCalledWith()
  })

  it('does not let an unlock failure replace a materialization error', async () => {
    const query = vi
      .fn<(...args: unknown[]) => Promise<{ rows: unknown[] }>>()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockRejectedValueOnce(new Error('connection lost'))
    const release = vi.fn()
    const db = {
      pool: { connect: vi.fn(async () => ({ query, release })) },
      schema: undefined,
    } as unknown as Database
    const computer = new StatsComputer(
      db,
      () =>
        ({
          materializeAll: vi.fn(async () => {
            throw new Error('materialization failed')
          }),
        }) as never,
      15,
    )
    const warn = vi.spyOn(dbLogger, 'warn')

    await expect((computer as any).materializeStats()).rejects.toThrow(
      'materialization failed',
    )

    expect(query.mock.calls[0]?.[1]).toEqual([STATS_COMPUTER_LOCK_ID, 'public'])
    expect(warn).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'failed to release stats materialization lock',
    )
    expect(release).toHaveBeenCalledWith(true)
  })

  it('discards the session when lock acquisition fails', async () => {
    const query = vi.fn(async () => {
      throw new Error('connection lost')
    })
    const release = vi.fn()
    const db = {
      pool: { connect: vi.fn(async () => ({ query, release })) },
      schema: 'ozone_stats_computer',
      db: { selectFrom: vi.fn(() => statsQuery) },
    } as unknown as Database
    const materializeAll = vi.fn(async () => ({ rowsWritten: 0 }))
    const computer = new StatsComputer(
      db,
      () => ({ materializeAll }) as never,
      15,
    )

    await expect((computer as any).materializeStats()).rejects.toThrow(
      'connection lost',
    )

    expect(materializeAll).not.toHaveBeenCalled()
    expect(release).toHaveBeenCalledWith(true)
  })

  it('returns a known-unlocked session to the pool', async () => {
    const query = vi
      .fn<(...args: unknown[]) => Promise<{ rows: unknown[] }>>()
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [{ unlocked: false }] })
    const release = vi.fn()
    const db = {
      pool: { connect: vi.fn(async () => ({ query, release })) },
      schema: 'ozone_stats_computer',
      db: { selectFrom: vi.fn(() => statsQuery) },
    } as unknown as Database
    const computer = new StatsComputer(
      db,
      () =>
        ({
          materializeAll: vi.fn(async () => ({ rowsWritten: 0 })),
        }) as never,
      15,
    )
    const warn = vi.spyOn(dbLogger, 'warn')

    await (computer as any).materializeStats()

    expect(warn).toHaveBeenCalledWith(
      'stats materialization lock was not held at release',
    )
    expect(release).toHaveBeenCalledWith()
  })
})
