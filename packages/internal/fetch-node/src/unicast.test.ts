import { assert, describe, expect, it, vi } from 'vitest'
import { unicastFetchWrap, unicastLookup } from './unicast.js'

vi.mock(import('node:dns'), async (importOriginal) => {
  const dns = await importOriginal()
  return {
    ...dns,
    lookup: ((hostname, options, callback) => {
      if (hostname === 'invalid.com') {
        setTimeout(callback, 0, null, '127.2.2.2', 4)
        return
      }

      if (hostname === 'valid.com') {
        setTimeout(callback, 0, null, '1.2.3.4', 4)
        return
      }

      // @ts-ignore
      return dns.lookup(hostname, options, callback)
    }) as typeof dns.lookup,
  }
})

describe(unicastLookup, () => {
  it('should reject hostnames that resolve to private IPs', async () => {
    await expect(
      new Promise((resolve, reject) => {
        unicastLookup('invalid.com', { all: true }, (err, address, family) => {
          if (err) {
            reject(err)
          } else {
            resolve({ address, family })
          }
        })
      }),
    ).rejects.toThrow('Hostname resolved to non-unicast address')
  })

  it('should allow hostnames that resolve to public IPs', async () => {
    await expect(
      new Promise((resolve, reject) => {
        unicastLookup('valid.com', { all: true }, (err, address, family) => {
          if (err) {
            reject(err)
          } else {
            resolve({ address, family })
          }
        })
      }),
    ).resolves.toEqual({ address: '1.2.3.4', family: 4 })
  })
})

describe(unicastFetchWrap, () => {
  describe('expected failures', () => {
    it('should reject private IPv4 hostnames', async () => {
      const fetch = unicastFetchWrap()
      await expect(fetch('http://127.0.0.1/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname is a non-unicast address'),
      )
    })

    it('should reject private IPv6 hostnames', async () => {
      const fetch = unicastFetchWrap()
      await expect(fetch('http://[::1]/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname is a non-unicast address'),
      )
    })

    it('should reject hostnames that are not public domain tlds', async () => {
      const fetch = unicastFetchWrap()
      await expect(fetch('http://localhost/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname is not a public domain'),
      )

      await expect(fetch('https://printer.local')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname is not a public domain'),
      )
    })

    it('should reject hostnames that resolve to private IPs', async () => {
      const fetch = unicastFetchWrap()
      await expect(fetch('http://invalid.com/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname resolved to non-unicast address'),
      )
    })
  })

  describe('expected successes', () => {
    // Let's avoid calling actual services in tests. There is no easy way to
    // ensure this works without a real public domain hostname that resolves to
    // a public IP. So we skip this test for now.
    it.skip('should allow public domain hostnames that resolve to public IPs', async () => {
      const fetch = unicastFetchWrap()
      await fetch('http://atproto.com/@atproto/node-fetch/test')
    })
  })

  describe('version handling', () => {
    it('should throw an error if undici version is too old', () => {
      using _ = vi
        .spyOn(process.versions, 'undici', 'get')
        .mockReturnValue('6.11.0')
      expect(process.versions.undici).toBe('6.11.0')
      expect(() => unicastFetchWrap()).toThrowError()
    })

    it('should support undici version 6.11.1', () => {
      using _ = vi
        .spyOn(process.versions, 'undici', 'get')
        .mockReturnValue('6.11.1')
      expect(process.versions.undici).toBe('6.11.1')
      expect(() => unicastFetchWrap()).not.toThrowError()
    })

    it('should throw an error if undici version is too new', () => {
      using _ = vi
        .spyOn(process.versions, 'undici', 'get')
        .mockReturnValue('9.0.0')
      expect(process.versions.undici).toBe('9.0.0')
      expect(() => unicastFetchWrap()).toThrowError()
    })
  })
})

function fetchFailedErrorCauseBy(message: string) {
  return (err: unknown) => {
    assert(err instanceof TypeError)
    expect(err.message).toBe('fetch failed')
    assert(err.cause instanceof Error)
    expect(err.cause.message).toBe(message)
    return true
  }
}
