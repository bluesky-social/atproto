import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FORBIDDEN_DOMAIN_NAMES,
  FetchRequestError,
  type ProtocolConfig,
  checkForbiddenDomainNamePolicy,
  checkHostHeaderPolicy,
  checkProtocolPolicy,
  forbiddenDomainNameRequestTransform,
  protocolCheckRequestTransform,
  requireHostHeaderTransform,
} from './fetch-request.js'

// These predicates are the security policy that `@atproto-labs/fetch-node`'s
// safeFetchWrap applies to every request it issues, including every redirect
// hop. The hop cases that cannot be reached from an integration test — a
// plaintext downgrade, a link-local address — are pinned down here.

const httpsOnly: ProtocolConfig = {
  'about:': false,
  'data:': false,
  'file:': false,
  'http:': false,
  'https:': { allowCustomPort: false },
}

describe(checkProtocolPolicy, () => {
  it('allows https', () => {
    expect(
      checkProtocolPolicy(new URL('https://example.com/'), httpsOnly),
    ).toBeUndefined()
  })

  it('rejects a plaintext http downgrade', () => {
    expect(checkProtocolPolicy(new URL('http://example.com/'), httpsOnly)).toBe(
      'Forbidden protocol "http:"',
    )
  })

  it.each(['data:text/plain,hi', 'file:///etc/passwd', 'about:blank'])(
    'rejects %s',
    (href) => {
      expect(checkProtocolPolicy(new URL(href), httpsOnly)).toMatch(
        /^Forbidden protocol/,
      )
    },
  )

  it('rejects a custom port when not allowed', () => {
    expect(
      checkProtocolPolicy(new URL('https://example.com:8443/'), httpsOnly),
    ).toBe('Custom https: ports not allowed')
  })

  it('allows a custom port when allowed', () => {
    expect(
      checkProtocolPolicy(new URL('https://example.com:8443/'), {
        ...httpsOnly,
        'https:': { allowCustomPort: true },
      }),
    ).toBeUndefined()
  })

  it('treats the default port as no port', () => {
    expect(
      checkProtocolPolicy(new URL('https://example.com:443/'), httpsOnly),
    ).toBeUndefined()
  })

  it('rejects a protocol absent from the config', () => {
    expect(checkProtocolPolicy(new URL('ftp://example.com/'), httpsOnly)).toBe(
      'Forbidden protocol "ftp:"',
    )
  })
})

describe(checkHostHeaderPolicy, () => {
  it('allows a domain name', () => {
    expect(
      checkHostHeaderPolicy(new URL('https://example.com/')),
    ).toBeUndefined()
  })

  it.each([
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
  ])('rejects the literal ip host in %s', (href) => {
    expect(checkHostHeaderPolicy(new URL(href))).toBe('Invalid hostname')
  })

  it('rejects a non-http protocol', () => {
    expect(checkHostHeaderPolicy(new URL('data:text/plain,hi'))).toBe(
      '"data:" requests are not allowed',
    )
  })
})

describe(checkForbiddenDomainNamePolicy, () => {
  const denySet = new Set(['example.com', '*.example.org'])

  it('allows a hostname that is not listed', () => {
    expect(
      checkForbiddenDomainNamePolicy(new URL('https://atproto.com/'), denySet),
    ).toBeUndefined()
  })

  it('rejects an exact match', () => {
    expect(
      checkForbiddenDomainNamePolicy(new URL('https://example.com/'), denySet),
    ).toBe('Forbidden hostname')
  })

  it('rejects a subdomain of a wildcard entry', () => {
    expect(
      checkForbiddenDomainNamePolicy(
        new URL('https://a.b.example.org/'),
        denySet,
      ),
    ).toBe('Forbidden hostname')
  })

  it('does not treat a wildcard entry as an exact match', () => {
    expect(
      checkForbiddenDomainNamePolicy(new URL('https://example.org/'), denySet),
    ).toBeUndefined()
  })
})

// The status code lives at the throw site rather than on the policy reason.
// It is load-bearing: `FetchError.expose` derives from it, and the OAuth
// provider uses `expose` to decide whether a client developer is told why
// their client_id was rejected. An inferred status would fall through to 500
// and silently swallow the reason.
describe('request transform status codes', () => {
  const expectThrows = async (
    fn: () => unknown,
    statusCode: number,
    message: string,
  ) => {
    try {
      await fn()
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(FetchRequestError)
      const fetchErr = err as FetchRequestError
      expect(fetchErr.statusCode).toBe(statusCode)
      expect(fetchErr.message).toBe(message)
      expect(fetchErr.expose).toBe(true)
    }
  }

  it('reports a protocol violation as an exposed 400', async () => {
    const transform = protocolCheckRequestTransform(httpsOnly)
    await expectThrows(
      () => transform('http://example.net/'),
      400,
      'Forbidden protocol "http:"',
    )
  })

  it('reports an ip host as an exposed 400', async () => {
    const transform = requireHostHeaderTransform()
    await expectThrows(
      () => transform('https://127.0.0.1/'),
      400,
      'Invalid hostname',
    )
  })

  it('reports a forbidden domain as an exposed 403', async () => {
    const transform = forbiddenDomainNameRequestTransform(
      DEFAULT_FORBIDDEN_DOMAIN_NAMES,
    )
    await expectThrows(
      () => transform('https://example.com/'),
      403,
      'Forbidden hostname',
    )
  })
})
