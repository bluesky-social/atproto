import {
  type ServerEnvironment,
  envToCfg,
  readEnv,
} from '../src/config/index.js'

describe('spaces migration config', () => {
  const baseEnv: ServerEnvironment = { blobstoreDiskLocation: '/tmp/blobs' }

  it('defaults to enabled', () => {
    expect(envToCfg(baseEnv).spacesMigration.state).toBe('enabled')
  })

  it.each(['disabled', 'enabled', 'complete'] as const)(
    'accepts %s',
    (state) => {
      const cfg = envToCfg({ ...baseEnv, spacesMigration: state })
      expect(cfg.spacesMigration.state).toBe(state)
    },
  )

  it('refuses an unknown state rather than guess', () => {
    expect(() => envToCfg({ ...baseEnv, spacesMigration: 'done' })).toThrow(
      /PDS_SPACES_MIGRATION/,
    )
  })

  it('is read from PDS_SPACES_MIGRATION', () => {
    const prev = process.env.PDS_SPACES_MIGRATION
    try {
      process.env.PDS_SPACES_MIGRATION = 'complete'
      expect(readEnv().spacesMigration).toBe('complete')
    } finally {
      if (prev === undefined) delete process.env.PDS_SPACES_MIGRATION
      else process.env.PDS_SPACES_MIGRATION = prev
    }
  })
})
