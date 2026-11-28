import { beforeEach, describe, expect, it, test, vi } from 'vitest'
import { events } from './events.js'

const { add, record } = vi.hoisted(() => ({
  record: vi.fn<(name: string, value: number, attributes?: object) => void>(),
  add: vi.fn<(name: string, value: number, attributes?: object) => void>(),
}))

vi.mock('@opentelemetry/api', () => ({
  SeverityNumber: { INFO: 9 },
  ValueType: { INT: 1, DOUBLE: 2 },
  diag: { error: vi.fn() },
  logs: { getLogger: () => ({ emit: vi.fn() }) },
  metrics: {
    getMeter: () => ({
      createCounter: (name: string) => ({
        add: (value: number, attributes?: object) =>
          add(name, value, attributes),
      }),
      createHistogram: (name: string) => ({
        record: (value: number, attributes?: object) =>
          record(name, value, attributes),
      }),
    }),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AppView request limit metrics', () => {
  it('records how long each granted request waited', () => {
    events.appViewRequestGranted({ waitMs: 0 })
    events.appViewRequestGranted({ waitMs: 412.5 })

    expect(record.mock.calls).toEqual([
      ['appview.request.limit.wait', 0, undefined],
      ['appview.request.limit.wait', 412.5, undefined],
    ])
  })

  it('counts rejected requests by reason', () => {
    events.appViewRequestRejected({ reason: 'queue_full' })
    events.appViewRequestRejected({ reason: 'queue_timeout' })

    expect(add.mock.calls).toEqual([
      ['appview.request.limit.rejected', 1, { reason: 'queue_full' }],
      ['appview.request.limit.rejected', 1, { reason: 'queue_timeout' }],
    ])
  })
})

describe('spaces migration metrics', () => {
  test.each([
    {
      note: 'migrated stores',
      report: () => events.spacesMigrationStoreMigrated(),
      name: 'spaces_migration.store_migrated',
    },
    {
      note: 'published KEM keys',
      report: () => events.spacesMigrationKemPublished(),
      name: 'spaces_migration.kem_published',
    },
  ])('counts $note', ({ report, name }) => {
    report()

    expect(add.mock.calls).toEqual([[name, 1, undefined]])
  })
})
