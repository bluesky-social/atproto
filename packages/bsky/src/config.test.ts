import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ServerConfig } from './config.js'
import { subLogger as log } from './logger.js'

describe('post view count cutoff configuration', () => {
  beforeEach(() => {
    vi.stubEnv('BSKY_DATAPLANE_URLS', 'http://localhost:3000')
    vi.stubEnv('BSKY_BSYNC_URL', 'http://localhost:3001')
    vi.stubEnv('MOD_SERVICE_DID', 'did:example:moderation')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  test.each([
    { name: 'missing', value: undefined, expected: undefined, warning: false },
    { name: 'empty', value: '', expected: undefined, warning: false },
    {
      name: 'valid UTC timestamp',
      value: '2026-11-18T00:00:00Z',
      expected: '2026-11-18T00:00:00.000Z',
      warning: false,
    },
    {
      name: 'timestamp with an offset',
      value: '2026-11-17T16:00:00-08:00',
      expected: '2026-11-18T00:00:00.000Z',
      warning: false,
    },
    {
      name: 'malformed',
      value: 'not-a-date',
      expected: undefined,
      warning: true,
    },
    {
      name: 'out of range',
      value: '2026-13-18T00:00:00Z',
      expected: undefined,
      warning: true,
    },
  ])('$name', ({ value, expected, warning }) => {
    vi.stubEnv('BSKY_POST_VIEW_COUNTS_START_AT', value)
    using warn = vi.spyOn(log, 'warn').mockImplementation(() => {})

    const config = ServerConfig.readEnv()

    expect(config.postViewCountsStartAt?.toISOString()).toBe(expected)
    expect(warn).toHaveBeenCalledTimes(warning ? 1 : 0)
    if (warning) {
      expect(warn).toHaveBeenCalledWith(
        { name: 'BSKY_POST_VIEW_COUNTS_START_AT' },
        'Invalid date environment variable',
      )
    }
  })
})
