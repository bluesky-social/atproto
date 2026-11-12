import { jest } from '@jest/globals'
import { envToCfg } from '../src/config/config.js'
import { readEnv } from '../src/config/env.js'

describe('online team member configuration', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  function configure(env: NodeJS.ProcessEnv = {}) {
    jest.replaceProperty(process, 'env', env)
    return envToCfg({
      ...readEnv(),
      publicUrl: 'https://ozone.example.com',
      serverDid: 'did:plc:ozone',
      dbPostgresUrl: 'postgresql://localhost/ozone',
      appviewUrl: 'https://appview.example.com',
      appviewDid: 'did:plc:appview',
      didPlcUrl: 'https://plc.example.com',
    }).onlineMembers
  }

  it('defaults to no extra exclusions and a five-minute activity window', () => {
    expect(configure()).toEqual({ excludedDids: [], activeWindowMs: 300000 })
    expect(
      configure({
        OZONE_ONLINE_MEMBERS_EXCLUDED_DIDS: '',
        OZONE_ONLINE_MEMBERS_ACTIVE_WINDOW_MS: '',
      }),
    ).toEqual({ excludedDids: [], activeWindowMs: 300000 })
  })

  it('parses, trims, and deduplicates excluded DIDs and a custom window', () => {
    expect(
      configure({
        OZONE_ONLINE_MEMBERS_EXCLUDED_DIDS:
          'did:example:one, did:example:two ,did:example:one',
        OZONE_ONLINE_MEMBERS_ACTIVE_WINDOW_MS: '60000',
      }),
    ).toEqual({
      excludedDids: ['did:example:one', 'did:example:two'],
      activeWindowMs: 60000,
    })
  })

  it.each(['invalid', 'did:example:one,invalid', 'did:example:one,'])(
    'rejects invalid excluded DIDs: %s',
    (value) => {
      expect(() =>
        configure({ OZONE_ONLINE_MEMBERS_EXCLUDED_DIDS: value }),
      ).toThrow('OZONE_ONLINE_MEMBERS_EXCLUDED_DIDS')
    },
  )

  it.each([
    '0',
    '-1',
    '1.5',
    'invalid',
    '60000ms',
    'Infinity',
    '9007199254740992',
  ])('rejects invalid activity windows: %s', (value) => {
    expect(() =>
      configure({ OZONE_ONLINE_MEMBERS_ACTIVE_WINDOW_MS: value }),
    ).toThrow('OZONE_ONLINE_MEMBERS_ACTIVE_WINDOW_MS')
  })
})
