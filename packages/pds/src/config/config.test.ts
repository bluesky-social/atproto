import { envToCfg } from './config.js'

describe('S3 internal blob redirect configuration', () => {
  const s3Config = (endpoint?: string, internalRedirects = false) => ({
    blobstoreS3Bucket: 'synthetic-fixture',
    blobstoreS3Endpoint: endpoint,
    blobstoreS3InternalRedirects: internalRedirects,
  })

  it('is disabled by default without restricting existing blobstores', () => {
    const config = envToCfg({
      blobstoreS3Bucket: 'synthetic-fixture',
      blobstoreS3Endpoint: 'http://private-storage.internal',
    })
    if (config.blobstore.provider !== 's3') {
      throw new Error('expected S3 configuration')
    }
    expect(config.blobstore.internalRedirects).toBe(false)
    expect(config.blobstore.endpoint).toBe('http://private-storage.internal')
  })

  it('accepts HTTPS endpoints when enabled', () => {
    const config = envToCfg(s3Config('https://storage.internal', true))
    if (config.blobstore.provider !== 's3') {
      throw new Error('expected S3 configuration')
    }
    expect(config.blobstore.internalRedirects).toBe(true)
  })

  it.each([
    'http://storage.internal',
    'http://localhost.test',
    'http://127.0.0.1.test',
    'ftp://storage.internal',
  ])('rejects an insecure or non-HTTP endpoint: %s', (endpoint) => {
    expect(() => envToCfg(s3Config(endpoint, true))).toThrow(
      'PDS_BLOBSTORE_S3_INTERNAL_REDIRECTS requires HTTPS',
    )
  })

  it.each(['http://localhost', 'http://127.0.0.1', 'http://[::1]'])(
    'allows HTTP only for an explicit local fixture: %s',
    (endpoint) => {
      const config = envToCfg(s3Config(endpoint, true))
      expect(config.blobstore.provider).toBe('s3')
      if (config.blobstore.provider === 's3') {
        expect(config.blobstore.internalRedirects).toBe(true)
      }
    },
  )

  it('rejects a malformed URL when the option is enabled', () => {
    expect(() => envToCfg(s3Config('not a URL', true))).toThrow()
  })
})
