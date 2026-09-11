import { gzipSync } from 'node:zlib'
import type { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { startServer } from '../_util.js'

// undici's maxResponseSize bounds what the proxy reads off the wire, but the
// buffering paths decode before they buffer, so they bound the decoded stream
// separately. These tests exercise that bound: wire size stays under the cap
// while decoded size exceeds it.

describe('proxied response decompression bounds', () => {
  const MAX_RESPONSE_SIZE = 64 * 1024 // both the wire cap and the decoded cap
  const DECODED_SIZE = 1024 * 1024 // ~1 MiB decoded, ~1 KiB gzipped

  let network: TestNetworkNoAppView
  let upstream: AsyncDisposable & { port: number }
  let agent: AtpAgent
  let headers: Record<string, string>
  let proxyHeader: string

  // A repo rev strictly between two local writes: everything after it counts
  // as "since rev" for getRecordsSinceRev, while a record at-or-before it
  // still exists so its sanity check (which bails out to an empty result if
  // *every* local record postdates the given rev, e.g. after an account
  // migration) doesn't discard the read-after-write splice.
  let sinceRev: string

  // Set per test, before issuing the request.
  let upstreamStatus: number
  let upstreamEncoding: 'gzip' | 'identity'
  let upstreamRepoRev: string | undefined

  beforeAll(async () => {
    upstream = await startServer((req, res) => {
      const raw = Buffer.from(
        JSON.stringify({ error: 'Bomb', message: 'A'.repeat(DECODED_SIZE) }),
      )
      const body = upstreamEncoding === 'gzip' ? gzipSync(raw) : raw
      res.writeHead(upstreamStatus, {
        'content-type': 'application/json',
        ...(upstreamEncoding === 'gzip'
          ? { 'content-encoding': 'gzip' }
          : undefined),
        ...(upstreamRepoRev
          ? { 'atproto-repo-rev': upstreamRepoRev }
          : undefined),
      })
      res.end(body)
    })

    network = await TestNetworkNoAppView.create({
      pds: { proxyMaxResponseSize: MAX_RESPONSE_SIZE },
    })
    const sc = network.getSeedClient()
    await sc.createAccount('alice', {
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice-pass',
    })

    const serviceDid = sc.dids.alice
    await network.plc
      .getClient()
      .updateData(serviceDid, network.pds.ctx.plcRotationKey, (x) => {
        x.services['atproto_test'] = {
          type: 'AtprotoTestService',
          endpoint: `http://localhost:${upstream.port}`,
        }
        return x
      })
    await network.pds.ctx.idResolver.did.resolve(serviceDid, true)

    agent = network.pds.getAgent()
    headers = sc.getHeaders(sc.dids.alice)
    proxyHeader = `${serviceDid}#atproto_test`

    // A local write, then a captured rev, then another local write -- so the
    // read-after-write path has a record strictly since `sinceRev` to splice
    // in, without `sinceRev` predating every local record (see `sinceRev`).
    await sc.post(sc.dids.alice, 'hello')
    const commit = await agent.api.com.atproto.sync.getLatestCommit({
      did: serviceDid,
    })
    sinceRev = commit.data.rev
    await sc.post(sc.dids.alice, 'world')
  }, 60_000)

  beforeEach(() => {
    upstreamStatus = 200
    upstreamEncoding = 'gzip'
    upstreamRepoRev = undefined
  })

  afterAll(async () => {
    await upstream?.[Symbol.asyncDispose]()
    await network?.close()
  })

  const getProfile = () =>
    agent.api.app.bsky.actor
      .getProfile(
        { actor: 'alice.test' },
        { headers: { ...headers, 'atproto-proxy': proxyHeader } },
      )
      .then(
        (res) => ({
          status: 200,
          error: undefined,
          message: undefined,
          data: res.data,
        }),
        (err) => ({
          status: err.status,
          error: err.error,
          message: err.message,
          data: undefined,
        }),
      )

  it('stops parsing an oversized decoded error body.', async () => {
    upstreamStatus = 418

    // tryParsingError swallows its own failures, so the upstream status is
    // still relayed on the wire -- but the client-side XRPC library maps any
    // HTTP status it doesn't recognize as a ResponseType (418 is not one) down
    // to 400, which is what we observe here. The load-bearing assertion is
    // that the oversized body must never be parsed, so the upstream's error
    // name must not reach the client.
    const res = await getProfile()

    expect(res.status).toBe(400)
    expect(res.error).not.toBe('Bomb')
  })

  it('rejects an oversized decoded read-after-write body.', async () => {
    upstreamRepoRev = sinceRev

    const res = await getProfile()

    expect(res.status).toBe(502)
    // Pins the specific size-failure label: a 502 alone does not distinguish
    // this from the generic "unable to decode request body" failure that the
    // catch-all branch in bufferUpstreamResponse() would otherwise produce.
    expect(res.message).toBe('upstream response too large')
    expect(res.data).toBeUndefined()
  })

  it('rejects an oversized body that is not compressed.', async () => {
    upstreamEncoding = 'identity'
    upstreamRepoRev = sinceRev

    const res = await getProfile()

    expect(res.status).toBe(502)
    expect(res.data).toBeUndefined()
  })
})
