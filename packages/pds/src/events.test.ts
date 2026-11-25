import { jest } from '@jest/globals'

const record =
  jest.fn<(name: string, value: number, attributes?: object) => void>()
const add =
  jest.fn<(name: string, value: number, attributes?: object) => void>()

jest.unstable_mockModule('@opentelemetry/api', () => ({
  SeverityNumber: { INFO: 9 },
  ValueType: { INT: 1, DOUBLE: 2 },
  diag: { error: jest.fn() },
  logs: { getLogger: () => ({ emit: jest.fn() }) },
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

const { events } = await import('./events.js')

beforeEach(() => {
  jest.clearAllMocks()
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
