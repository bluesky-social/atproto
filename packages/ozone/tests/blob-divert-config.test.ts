import { jest } from '@jest/globals'
import { envToCfg } from '../src/config/config.js'
import { readEnv } from '../src/config/env.js'

describe('blob diversion configuration', () => {
  afterEach(() => jest.restoreAllMocks())

  function configure(value?: string) {
    jest.replaceProperty(process, 'env', {
      ...(value === undefined ? {} : { OZONE_BLOB_DIVERT_MAX_BYTES: value }),
    })
    return envToCfg({
      ...readEnv(),
      publicUrl: 'https://ozone.example.com',
      serverDid: 'did:plc:ozone',
      dbPostgresUrl: 'postgresql://localhost/ozone',
      appviewUrl: 'https://appview.example.com',
      appviewDid: 'did:plc:appview',
      didPlcUrl: 'https://plc.example.com',
      blobDivertUrl: 'https://divert.example.com',
      blobDivertAdminPassword: 'password',
    }).blobDivert
  }

  it('defaults to 300 MiB and accepts a custom byte limit', () => {
    expect(configure()?.maxBytes).toBe(300 * 1024 * 1024)
    expect(configure('1024')?.maxBytes).toBe(1024)
  })

  it.each([
    '0',
    '-1',
    '1.5',
    'invalid',
    '1024bytes',
    'Infinity',
    '9007199254740992',
  ])('rejects an invalid byte limit: %s', (value) => {
    expect(() => configure(value)).toThrow('OZONE_BLOB_DIVERT_MAX_BYTES')
  })
})
