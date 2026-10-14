import { envToCfg } from './config.js'
import { type OzoneEnvironment, readEnv } from './env.js'

const env: OzoneEnvironment = {
  publicUrl: 'https://ozone.example',
  serverDid: 'did:example:ozone',
  dbPostgresUrl: 'postgres://localhost/ozone',
  appviewUrl: 'https://appview.example',
  appviewDid: 'did:example:appview',
  didPlcUrl: 'https://plc.directory',
  adminDids: [],
  moderatorDids: [],
  triageDids: [],
}

it.each([
  [undefined, 180],
  [30, 30],
])('configures reporter history from %s as %i days', (days, expected) => {
  const cfg = envToCfg({ ...env, reporterStatsWindowDays: days })
  expect(cfg.stats.reporterWindowDays).toBe(expected)
})

it.each([0, -1, 1.5, NaN])('rejects invalid reporter history: %s', (days) => {
  expect(() => envToCfg({ ...env, reporterStatsWindowDays: days })).toThrow(
    'OZONE_REPORTER_STATS_WINDOW_DAYS must be a positive integer',
  )
})

it('reads the reporter history environment variable', () => {
  const previous = process.env.OZONE_REPORTER_STATS_WINDOW_DAYS
  try {
    process.env.OZONE_REPORTER_STATS_WINDOW_DAYS = '30'
    expect(readEnv().reporterStatsWindowDays).toBe(30)
  } finally {
    if (previous === undefined)
      delete process.env.OZONE_REPORTER_STATS_WINDOW_DAYS
    else process.env.OZONE_REPORTER_STATS_WINDOW_DAYS = previous
  }
})
