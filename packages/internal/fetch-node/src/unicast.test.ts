import { lookup as dnsLookup } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { assert, describe, expect, it, vi } from 'vitest'
import { stubResolvers } from '../tests/_util.js'
import {
  checkUnicastPolicy,
  createUnicastFetch,
  unicastLookup,
} from './unicast.js'

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

describe(checkUnicastPolicy, () => {
  // `unicastLookup` cannot cover these: NodeJS performs no DNS resolution for a
  // literal-IP host, so the connect-time guard is never invoked for one.
  it.each([
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'http://[::1]/',
  ])('rejects the non-unicast literal ip in %s', (href) => {
    expect(checkUnicastPolicy(new URL(href))).toBe(
      'Hostname is a non-unicast address',
    )
  })

  it('allows a public literal ip', () => {
    expect(checkUnicastPolicy(new URL('http://1.1.1.1/'))).toBeUndefined()
  })

  it('defers a domain name to the connect-time lookup', () => {
    expect(checkUnicastPolicy(new URL('http://example.com/'))).toBeUndefined()
  })
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

describe(createUnicastFetch, () => {
  describe('expected failures', () => {
    it('should reject private IPv4 hostnames', async () => {
      const fetch = createUnicastFetch()
      await expect(fetch('http://127.0.0.1/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname is a non-unicast address'),
      )
    })

    it('should reject private IPv6 hostnames', async () => {
      const fetch = createUnicastFetch()
      await expect(fetch('http://[::1]/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname is a non-unicast address'),
      )
    })

    it('should reject hostnames that are not public domain tlds', async () => {
      const fetch = createUnicastFetch()
      await expect(fetch('http://localhost/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname is not a public domain'),
      )

      await expect(fetch('https://printer.local')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname is not a public domain'),
      )
    })

    it('should reject hostnames that resolve to private IPs', async () => {
      using _ = stubResolvers({ 'invalid.com': ['127.2.2.2'] })
      const fetch = createUnicastFetch()
      await expect(fetch('http://invalid.com/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname resolved to non-unicast address'),
      )
    })
  })

  describe('hostname resolution', () => {
    // The mocked `dns.lookup` and the stubbed resolvers disagree on these
    // hostnames: which address is rejected tells which one resolved them.

    it('uses a dns.Resolver by default', async () => {
      using resolvers = stubResolvers({ 'valid.com': ['127.0.0.1'] })
      const fetch = createUnicastFetch()

      await expect(fetch('http://valid.com/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname resolved to non-unicast address'),
      )
      expect(resolvers.resolve4).toHaveBeenCalledWith('valid.com')
    })

    it('uses dns.lookup when given as lookup', async () => {
      using resolvers = stubResolvers({ 'invalid.com': ['1.2.3.4'] })
      const fetch = createUnicastFetch({ lookup: dnsLookup })

      await expect(fetch('http://invalid.com/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname resolved to non-unicast address'),
      )
      expect(resolvers.resolve4).not.toHaveBeenCalled()
      expect(resolvers.resolve6).not.toHaveBeenCalled()
    })
  })

  describe('custom lookup', () => {
    it('applies the unicast check to its result', async () => {
      // `valid.com` resolves to a public IP through the mocked `dns.lookup`:
      // the rejection proves the custom lookup replaced it.
      using lookup = staticLookup('127.0.0.1', 4)
      const fetch = createUnicastFetch({ lookup })

      await expect(fetch('http://valid.com/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname resolved to non-unicast address'),
      )
      expect(lookup).toHaveBeenCalledWith(
        'valid.com',
        expect.anything(),
        expect.any(Function),
      )
    })

    it('is not called for hostnames that are not public domain tlds', async () => {
      using lookup = staticLookup('1.2.3.4', 4)
      const fetch = createUnicastFetch({ lookup })

      await expect(fetch('http://localhost/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname is not a public domain'),
      )
      expect(lookup).not.toHaveBeenCalled()
    })

    it('forwards its errors', async () => {
      using lookup = vi.fn<LookupFunction>((_hostname, _options, callback) => {
        setTimeout(callback, 0, new Error('Lookup timed out'), [])
      })
      const fetch = createUnicastFetch({ lookup })

      await expect(fetch('http://valid.com/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Lookup timed out'),
      )
    })

    it.each(['010.0.0.1', '0x7f.0.0.1', 'valid.com', ''])(
      'rejects the invalid address %j',
      async (address) => {
        // `ipaddr.js` would read `010.0.0.1` as the unicast `8.0.0.1`
        using lookup = staticLookup(address, 4)
        const fetch = createUnicastFetch({ lookup })

        await expect(fetch('http://valid.com/test')).rejects.toSatisfy(
          fetchFailedErrorCauseBy('Hostname resolved to an invalid address'),
        )
      },
    )

    it('rejects an empty result', async () => {
      // `net.connect` throws an uncaught exception when an `all` lookup
      // succeeds without any address.
      using lookup = vi.fn<LookupFunction>((_hostname, _options, callback) => {
        setTimeout(callback, 0, null, [])
      })
      const fetch = createUnicastFetch({ lookup })

      await expect(fetch('http://valid.com/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname did not resolve to any address'),
      )
    })

    it('derives the family from the address, not from the lookup', async () => {
      // Parsing by the reported family would throw from the (asynchronous)
      // callback, escaping as an uncaught exception instead of a rejection.
      using lookup = staticLookup('127.0.0.1', 6)
      const fetch = createUnicastFetch({ lookup })

      await expect(fetch('http://valid.com/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('Hostname resolved to non-unicast address'),
      )
    })
  })

  describe('expected successes', () => {
    // Let's avoid calling actual services in tests. There is no easy way to
    // ensure this works without a real public domain hostname that resolves to
    // a public IP. So we skip this test for now.
    it.skip('should allow public domain hostnames that resolve to public IPs', async () => {
      const fetch = createUnicastFetch()
      await fetch('http://atproto.com/@atproto/node-fetch/test')
    })
  })

  describe('disposal', () => {
    it('destroys the dispatcher', async () => {
      using lookup = staticLookup('1.2.3.4', 4)
      const fetch = createUnicastFetch({ lookup })

      await fetch[Symbol.asyncDispose]()

      await expect(fetch('http://valid.com/test')).rejects.toSatisfy(
        fetchFailedErrorCauseBy('The client is destroyed'),
      )
      expect(lookup).not.toHaveBeenCalled()
    })
  })

  describe('version handling', () => {
    it('should throw an error if undici version is too old', () => {
      using _ = vi
        .spyOn(process.versions, 'undici', 'get')
        .mockReturnValue('6.11.0')
      expect(process.versions.undici).toBe('6.11.0')
      expect(() => createUnicastFetch()).toThrowError()
    })

    it('should support undici version 6.11.1', () => {
      using _ = vi
        .spyOn(process.versions, 'undici', 'get')
        .mockReturnValue('6.11.1')
      expect(process.versions.undici).toBe('6.11.1')
      expect(() => createUnicastFetch()).not.toThrowError()
    })

    it('should throw an error if undici version is too new', () => {
      using _ = vi
        .spyOn(process.versions, 'undici', 'get')
        .mockReturnValue('9.0.0')
      expect(process.versions.undici).toBe('9.0.0')
      expect(() => createUnicastFetch()).toThrowError()
    })
  })
})

/**
 * A lookup that answers every hostname with {@link address}, honoring
 * `options.all` as `net.connect` requires.
 */
function staticLookup(address: string, family: number) {
  return vi.fn<LookupFunction>((_hostname, options, callback) => {
    if (options.all) setTimeout(callback, 0, null, [{ address, family }])
    else setTimeout(callback, 0, null, address, family)
  })
}

function fetchFailedErrorCauseBy(message: string) {
  return (err: unknown) => {
    assert(err instanceof TypeError)
    expect(err.message).toBe('fetch failed')
    assert(err.cause instanceof Error)
    expect(err.cause.message).toBe(message)
    return true
  }
}
