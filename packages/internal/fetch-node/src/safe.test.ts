import { type RequestListener, createServer } from 'node:http'
import type { AddressInfo, LookupFunction } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubResolvers } from '../tests/_util.js'
import { createSafeFetch } from './safe.js'

type TestServer = AsyncDisposable & { origin: (host?: string) => string }

const servers: TestServer[] = []

async function startServer(listener: RequestListener): Promise<TestServer> {
  const server = createServer(listener)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  const testServer: TestServer = {
    origin: (host = '127.0.0.1') => `http://${host}:${port}`,
    [Symbol.asyncDispose]: () =>
      new Promise<void>((resolve) => server.close(() => resolve())),
  }
  servers.push(testServer)
  return testServer
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s[Symbol.asyncDispose]()))
})

/**
 * A server that records every request it receives, so a test can assert that a
 * blocked hop never reached the network rather than merely that it errored.
 */
async function recordingServer(listener?: RequestListener) {
  const requests: string[] = []
  const server = await startServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push(`${req.method} ${req.url} ${body}`)
    if (listener) return listener(req, res)
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('final')
  })
  return { ...server, requests }
}

async function redirectingServer(location: () => string, status = 302) {
  return startServer((req, res) => {
    res.writeHead(status, { location: location() })
    res.end()
  })
}

describe(createSafeFetch, () => {
  it('follows a redirect to an allowed destination', async () => {
    const target = await recordingServer()
    const entry = await redirectingServer(() => `${target.origin()}/final`)

    const safeFetch = createSafeFetch({
      ssrfProtection: false,
      forbiddenDomainNames: [],
    })

    const res = await safeFetch(`${entry.origin('localhost')}/start`, {
      redirect: 'follow',
    })

    expect(res.status).toBe(200)
    await expect(res.text()).resolves.toBe('final')
    expect(target.requests).toHaveLength(1)
  })

  it('applies the url policy to redirect hops, not just the initial url', async () => {
    const target = await recordingServer()
    const entry = await redirectingServer(() => `${target.origin()}/final`)

    // The entry point is reached over `localhost`; the redirect hop lands on
    // `127.0.0.1`, which the deny list forbids. Only a per-hop check can catch
    // it — the initial url is perfectly acceptable.
    const safeFetch = createSafeFetch({
      ssrfProtection: false,
      forbiddenDomainNames: ['127.0.0.1'],
    })

    // The rejection must name the hop that was refused — the initial url is
    // all that reaches the fetch logger, so without this the operator has no
    // way to tell where the request was redirected to.
    await expect(
      safeFetch(`${entry.origin('localhost')}/start`, { redirect: 'follow' }),
    ).rejects.toSatisfy(
      causedBy(
        `Blocked by url policy (${target.origin()}): Forbidden hostname`,
      ),
    )

    // Load-bearing: an error alone could come from anywhere. An empty request
    // log proves the connection was never made.
    expect(target.requests).toEqual([])
  })

  it('applies the url policy to redirect hops when ssrf protection is disabled', async () => {
    const target = await recordingServer()
    const entry = await redirectingServer(() => `${target.origin()}/final`)

    // `ssrfProtection: false` relaxes the unicast requirement. It must not
    // silently disable the remaining per-hop checks.
    const safeFetch = createSafeFetch({
      ssrfProtection: false,
      allowPrivateIps: true,
      forbiddenDomainNames: ['127.0.0.1'],
    })

    await expect(
      safeFetch(`${entry.origin('localhost')}/start`, { redirect: 'follow' }),
    ).rejects.toThrow()

    expect(target.requests).toEqual([])
  })

  it('rejects a redirect hop onto a literal ip host', async () => {
    const target = await recordingServer()
    const entry = await redirectingServer(() => `${target.origin()}/final`)

    // `allowIpHost: false` rejects literal-IP hosts. The entry point is a
    // domain name, so only a per-hop check can see the `127.0.0.1` hop. This
    // stands in for the case the connect-time DNS guard structurally cannot
    // catch: NodeJS performs no lookup for a literal ip.
    const safeFetch = createSafeFetch({
      ssrfProtection: false,
      allowIpHost: false,
      forbiddenDomainNames: [],
    })

    await expect(
      safeFetch(`${entry.origin('localhost')}/start`, { redirect: 'follow' }),
    ).rejects.toThrow()

    expect(target.requests).toEqual([])
  })

  it('rejects a redirect hop whose path makes the url protocol-relative', async () => {
    const target = await recordingServer()
    // A pathname beginning with `//` is protocol-relative. A per-hop check that
    // resolves the path against the origin therefore discards the origin and
    // judges the path as if it were the host: this hop must be attributed to
    // `127.0.0.1`, not to `evil.example.com`.
    const entry = await redirectingServer(
      () => `${target.origin()}//evil.example.com/final`,
    )

    const safeFetch = createSafeFetch({
      ssrfProtection: false,
      allowIpHost: false,
      forbiddenDomainNames: [],
    })

    await expect(
      safeFetch(`${entry.origin('localhost')}/start`, { redirect: 'follow' }),
    ).rejects.toSatisfy(
      causedBy(`Blocked by url policy (${target.origin()}): Invalid hostname`),
    )

    expect(target.requests).toEqual([])
  })

  it('rejects a protocol-relative redirect hop onto a bracketed IPv6 host', async () => {
    const target = await recordingServer()
    // Same shape, with an IPv6 literal: the brackets `URL` keeps in `hostname`
    // are what the ip checks match on, so the hop must stay attributed to
    // `[::1]`. Nothing needs to listen there — the hop is refused before a
    // connection is attempted.
    const entry = await redirectingServer(
      () => `${target.origin('[::1]')}//evil.example.com/final`,
    )

    const safeFetch = createSafeFetch({
      ssrfProtection: false,
      allowIpHost: false,
      forbiddenDomainNames: [],
    })

    await expect(
      safeFetch(`${entry.origin('localhost')}/start`, { redirect: 'follow' }),
    ).rejects.toSatisfy(
      causedBy(
        `Blocked by url policy (${target.origin('[::1]')}): Invalid hostname`,
      ),
    )

    expect(target.requests).toEqual([])
  })

  it('still rejects a forbidden domain on the initial url', async () => {
    const safeFetch = createSafeFetch({
      ssrfProtection: false,
      forbiddenDomainNames: ['example.com'],
    })

    await expect(
      safeFetch('http://example.com/', { redirect: 'follow' }),
    ).rejects.toThrow('Forbidden hostname')
  })

  it('replays the request body across a 307 redirect', async () => {
    const target = await recordingServer()
    const entry = await redirectingServer(() => `${target.origin()}/final`, 307)

    const safeFetch = createSafeFetch({
      ssrfProtection: false,
      forbiddenDomainNames: [],
    })

    const res = await safeFetch(`${entry.origin('localhost')}/start`, {
      redirect: 'follow',
      method: 'POST',
      body: '{"replayed":true}',
      headers: { 'content-type': 'application/json' },
    })

    expect(res.status).toBe(200)
    expect(target.requests).toEqual(['POST /final {"replayed":true}'])
  })

  describe('custom lookup', () => {
    it('applies the unicast check to its result', async () => {
      const target = await recordingServer()
      using lookup = loopbackLookup()

      const safeFetch = createSafeFetch({
        allowHttp: true,
        allowCustomPort: true,
        forbiddenDomainNames: [],
        lookup,
      })

      await expect(
        safeFetch(`${target.origin('custom.com')}/final`, {
          redirect: 'error',
        }),
      ).rejects.toSatisfy(causedBy('Hostname resolved to non-unicast address'))

      expect(lookup).toHaveBeenCalled()
      expect(target.requests).toEqual([])
    })

    it('is used as is when private ips are allowed', async () => {
      const target = await recordingServer()
      using lookup = loopbackLookup()

      const safeFetch = createSafeFetch({
        ssrfProtection: false,
        forbiddenDomainNames: [],
        lookup,
      })

      const res = await safeFetch(`${target.origin('custom.com')}/final`, {
        redirect: 'error',
      })

      expect(res.status).toBe(200)
      expect(lookup).toHaveBeenCalled()
      expect(target.requests).toEqual(['GET /final '])
    })
  })

  describe('default lookup', () => {
    it('is a dns.Resolver', async () => {
      const target = await recordingServer()
      using resolvers = stubResolvers({ 'custom.com': ['127.0.0.1'] })

      const safeFetch = createSafeFetch({
        allowHttp: true,
        allowCustomPort: true,
        forbiddenDomainNames: [],
      })

      await expect(
        safeFetch(`${target.origin('custom.com')}/final`, {
          redirect: 'error',
        }),
      ).rejects.toSatisfy(causedBy('Hostname resolved to non-unicast address'))

      expect(resolvers.resolve4).toHaveBeenCalledWith('custom.com')
      expect(target.requests).toEqual([])
    })

    it('is dns.lookup when private ips are allowed', async () => {
      const target = await recordingServer()
      using resolvers = stubResolvers({})

      // Local services are commonly named in /etc/hosts, which only
      // `dns.lookup` reads.
      const safeFetch = createSafeFetch({
        ssrfProtection: false,
        forbiddenDomainNames: [],
      })

      const res = await safeFetch(`${target.origin('localhost')}/final`, {
        redirect: 'error',
      })

      expect(res.status).toBe(200)
      expect(target.requests).toEqual(['GET /final '])
      expect(resolvers.resolve4).not.toHaveBeenCalled()
      expect(resolvers.resolve6).not.toHaveBeenCalled()
    })
  })

  describe('disposal', () => {
    it('destroys the dispatcher', async () => {
      const target = await recordingServer()
      const safeFetch = createSafeFetch({
        ssrfProtection: false,
        forbiddenDomainNames: [],
      })

      const res = await safeFetch(`${target.origin()}/final`, {
        redirect: 'error',
      })
      await expect(res.text()).resolves.toBe('final')

      await safeFetch[Symbol.asyncDispose]()

      await expect(
        safeFetch(`${target.origin()}/final`, { redirect: 'error' }),
      ).rejects.toSatisfy(causedBy('The client is destroyed'))
      expect(target.requests).toHaveLength(1)
    })

    it('aborts requests in flight', async () => {
      let onRequest!: () => void
      const received = new Promise<void>((resolve) => (onRequest = resolve))
      // Never responds: disposal must not wait for the request to complete.
      const target = await startServer(() => onRequest())
      const safeFetch = createSafeFetch({
        ssrfProtection: false,
        forbiddenDomainNames: [],
      })

      const pending = safeFetch(`${target.origin()}/`, { redirect: 'error' })
      await received

      await safeFetch[Symbol.asyncDispose]()

      await expect(pending).rejects.toSatisfy(
        causedBy('The client is destroyed'),
      )
    })
  })
})

/**
 * A lookup that resolves every hostname to the loopback address the test
 * servers listen on.
 */
function loopbackLookup() {
  return vi.fn<LookupFunction>((_hostname, options, callback) => {
    if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }])
    else callback(null, '127.0.0.1', 4)
  })
}

function causedBy(message: string) {
  return (err: unknown) => {
    expect(err).toBeInstanceOf(TypeError)
    expect((err as TypeError).cause).toBeInstanceOf(Error)
    expect(((err as TypeError).cause as Error).message).toBe(message)
    return true
  }
}
