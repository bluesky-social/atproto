import { once } from 'node:events'
import http from 'node:http'
import { performance } from 'node:perf_hooks'
import { setTimeout as sleep } from 'node:timers/promises'
import * as plc from '@did-plc/lib'
import type { Keypair } from '@atproto/crypto'
import { TestNetworkNoAppView, type TestServerParams } from '@atproto/dev-env'

const APPVIEW_DID = 'did:example:fakeappview'

describe('PDS requests to a fake AppView', () => {
  let appview: FakeUpstream
  let otherService: FakeUpstream
  let otherServiceDid: string
  let network: TestNetworkNoAppView
  let accessJwt: string

  beforeAll(async () => {
    appview = await FakeUpstream.start()
    network = await createNetworkWithAppView(appview)

    otherService = await FakeUpstream.start()
    otherServiceDid = await registerServiceDid(
      network.pds.ctx.plcClient,
      network.pds.ctx.plcRotationKey,
      'proxy_test',
      otherService.url,
    )

    const res = await network.pds.getAgent().createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    accessJwt = res.data.accessJwt
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
    await otherService?.close()
    await appview?.close()
  })

  beforeEach(() => {
    appview.reset()
    otherService.reset()
  })

  // Catch-all path: the PDS has no handler for app.bsky.feed.getLikes, so
  // proxyHandler() forwards it with appViewProxyAgent.stream().
  it('forwards an unhandled app.bsky method to the AppView (catch-all)', async () => {
    const res = await pdsGet(
      network.pds.url,
      'app.bsky.feed.getLikes',
      { uri: 'at://did:example:alice/app.bsky.feed.post/1' },
      { accessJwt },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ nsid: 'app.bsky.feed.getLikes' })
    expect(appview.arrivalsFor('app.bsky.feed.getLikes')).toEqual([
      expect.objectContaining({ method: 'GET', hasAuthorization: true }),
    ])
  })

  // Buffered path: com.atproto.repo.getRecord for a repo this PDS does not
  // host calls pipethrough(), which sends with appViewProxyAgent.request().
  // It needs the least setup of the pipethrough() callers: no auth and no
  // prior AppView call (getFeed first fetches the feed record through
  // bskyAppView.client; getPreferences only pipes through to a different
  // AppView; read-after-write handlers need an account and munge responses).
  it('forwards a pipethrough() handler request to the AppView (buffered)', async () => {
    const res = await pdsGet(network.pds.url, 'com.atproto.repo.getRecord', {
      repo: 'did:plc:notonthispds',
      collection: 'app.bsky.feed.post',
      rkey: 'abc',
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ nsid: 'com.atproto.repo.getRecord' })
    expect(appview.arrivalsFor('com.atproto.repo.getRecord')).toEqual([
      expect.objectContaining({ method: 'GET', hasAuthorization: false }),
    ])
  })

  // An atproto-proxy header naming another service selects ctx.proxyAgent,
  // not appViewProxyAgent.
  it('sends an atproto-proxy request for another service there, not to the AppView', async () => {
    const res = await pdsGet(
      network.pds.url,
      'app.bsky.feed.getLikes',
      { uri: 'at://did:example:alice/app.bsky.feed.post/1' },
      { accessJwt, proxy: `${otherServiceDid}#proxy_test` },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ nsid: 'app.bsky.feed.getLikes' })
    expect(otherService.arrivalsFor('app.bsky.feed.getLikes')).toHaveLength(1)
    expect(appview.arrivals).toHaveLength(0)
  })

  it('holds AppView responses open until released', async () => {
    appview.hold()
    const pending = [1, 2].map(() =>
      pdsGet(
        network.pds.url,
        'app.bsky.feed.getLikes',
        { uri: 'at://did:example:alice/app.bsky.feed.post/1' },
        { accessJwt },
      ),
    )
    await appview.waitForArrivals(2)
    expect(appview.heldCount).toBe(2)

    appview.release(1)
    const first = await Promise.race(pending)
    expect(first.status).toBe(200)
    expect(appview.heldCount).toBe(1)

    appview.release()
    const all = await Promise.all(pending)
    expect(all.map((r) => r.status)).toEqual([200, 200])
    await Promise.all(all.map((r) => r.text()))
    expect(appview.heldCount).toBe(0)
  })
})

describe('PDS limit on requests to the AppView', () => {
  let appview: FakeUpstream
  let otherService: FakeUpstream
  let otherServiceDid: string
  let network: TestNetworkNoAppView
  let accessJwt: string

  const getLikes = () =>
    pdsGet(
      network.pds.url,
      'app.bsky.feed.getLikes',
      { uri: 'at://did:example:alice/app.bsky.feed.post/1' },
      { accessJwt },
    )

  beforeAll(async () => {
    appview = await FakeUpstream.start()
    // One request in flight and one waiting, so that a test can fill both
    // with two requests. No rate limit: the tests do not depend on the clock.
    network = await createNetworkWithAppView(appview, {
      bskyAppViewMaxRequestsPerSecond: 0,
      bskyAppViewMaxConcurrentRequests: 1,
      bskyAppViewMaxQueuedRequests: 1,
      bskyAppViewMaxQueueMs: 60_000,
    })

    otherService = await FakeUpstream.start()
    otherServiceDid = await registerServiceDid(
      network.pds.ctx.plcClient,
      network.pds.ctx.plcRotationKey,
      'proxy_test',
      otherService.url,
    )

    const res = await network.pds.getAgent().createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })
    accessJwt = res.data.accessJwt
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
    await otherService?.close()
    await appview?.close()
  })

  beforeEach(() => {
    appview.reset()
    otherService.reset()
  })

  it('sends no more requests to the AppView than the concurrency cap allows', async () => {
    appview.hold()
    const pending = [getLikes(), getLikes()]

    await appview.waitForArrivals(1)
    await sleep(200)
    expect(appview.arrivals).toHaveLength(1)

    appview.release(1)
    await appview.waitForArrivals(2)

    appview.release()
    const responses = await Promise.all(pending)
    expect(responses.map((r) => r.status)).toEqual([200, 200])
    await Promise.all(responses.map((r) => r.text()))
  })

  // Catch-all path (appViewProxyAgent.stream()).
  it('answers 429 with Retry-After when the queue is full', async () => {
    appview.hold()
    const inFlight = getLikes()
    await appview.waitForArrivals(1)
    const queued = getLikes()
    // Nothing observable outside the PDS says the second request has reached
    // the queue, so give it time to get there before sending the third.
    await sleep(200)

    const rejected = await getLikes()
    expect(rejected.status).toBe(429)
    expect(await rejected.json()).toMatchObject({ error: 'RateLimitExceeded' })
    expect(Number(rejected.headers.get('retry-after'))).toBeGreaterThanOrEqual(
      1,
    )
    expect(appview.arrivals).toHaveLength(1)

    appview.release()
    const responses = await Promise.all([inFlight, queued])
    expect(responses.map((r) => r.status)).toEqual([200, 200])
    await Promise.all(responses.map((r) => r.text()))
  })

  // Buffered path (pipethrough(), appViewProxyAgent.request()): the handler
  // has only `req`, so this also proves the header reaches the response there.
  it('answers 429 with Retry-After from a pipethrough() handler too', async () => {
    appview.hold()
    const inFlight = getLikes()
    await appview.waitForArrivals(1)
    const queued = getLikes()
    await sleep(200)

    const rejected = await pdsGet(
      network.pds.url,
      'com.atproto.repo.getRecord',
      {
        repo: 'did:plc:notonthispds',
        collection: 'app.bsky.feed.post',
        rkey: 'abc',
      },
    )
    expect(rejected.status).toBe(429)
    expect(await rejected.json()).toMatchObject({ error: 'RateLimitExceeded' })
    expect(Number(rejected.headers.get('retry-after'))).toBeGreaterThanOrEqual(
      1,
    )
    expect(appview.arrivalsFor('com.atproto.repo.getRecord')).toHaveLength(0)

    appview.release()
    const responses = await Promise.all([inFlight, queued])
    await Promise.all(responses.map((r) => r.text()))
  })

  // com.atproto.identity.resolveHandle asks the AppView itself, with
  // ctx.bskyAppView.client, for a handle this PDS does not host. That call
  // does not go through appViewProxyAgent.
  it("counts a handler's own call to the AppView against the cap", async () => {
    appview.hold()
    const inFlight = getLikes()
    await appview.waitForArrivals(1)

    const resolving = pdsGet(
      network.pds.url,
      'com.atproto.identity.resolveHandle',
      { handle: 'bob.example.com' },
    )
    await sleep(200)
    expect(appview.arrivals).toHaveLength(1)

    appview.release(1)
    await appview.waitForArrivals(2)
    expect(
      appview.arrivalsFor('com.atproto.identity.resolveHandle'),
    ).toHaveLength(1)

    appview.release()
    const responses = await Promise.all([inFlight, resolving])
    await Promise.all(responses.map((r) => r.text()))
  })

  // app.bsky.feed.getFeed first fetches the feed's record from the AppView
  // with ctx.bskyAppView.client. A limiter rejection there comes back from the
  // lex client wrapped in a fetch error, which would otherwise answer 502.
  it("answers 429 with Retry-After when the limit turns away a handler's own call", async () => {
    appview.hold()
    const inFlight = getLikes()
    await appview.waitForArrivals(1)
    const queued = getLikes()
    await sleep(200)

    const rejected = await pdsGet(
      network.pds.url,
      'app.bsky.feed.getFeed',
      { feed: 'at://did:example:feedgen/app.bsky.feed.generator/test' },
      { accessJwt },
    )
    expect(rejected.status).toBe(429)
    expect(await rejected.json()).toMatchObject({ error: 'RateLimitExceeded' })
    expect(Number(rejected.headers.get('retry-after'))).toBeGreaterThanOrEqual(
      1,
    )
    expect(appview.arrivalsFor('com.atproto.repo.getRecord')).toHaveLength(0)

    appview.release()
    const responses = await Promise.all([inFlight, queued])
    await Promise.all(responses.map((r) => r.text()))
  })

  // Both handlers send the AppView a POST themselves, with
  // ctx.bskyAppView.client, when the push service named is the AppView.
  it.each([
    'app.bsky.notification.registerPush',
    'app.bsky.notification.unregisterPush',
  ])('answers 429 with Retry-After from %s too', async (nsid) => {
    appview.hold()
    const inFlight = getLikes()
    await appview.waitForArrivals(1)
    const queued = getLikes()
    await sleep(200)

    const rejected = await pdsPost(
      network.pds.url,
      nsid,
      {
        serviceDid: APPVIEW_DID,
        token: 'push-token',
        platform: 'ios',
        appId: 'xyz.blueskyweb.app',
      },
      { accessJwt },
    )
    expect(rejected.status).toBe(429)
    expect(await rejected.json()).toMatchObject({ error: 'RateLimitExceeded' })
    expect(Number(rejected.headers.get('retry-after'))).toBeGreaterThanOrEqual(
      1,
    )
    expect(appview.arrivalsFor(nsid)).toHaveLength(0)

    appview.release()
    const responses = await Promise.all([inFlight, queued])
    await Promise.all(responses.map((r) => r.text()))
  })

  it('does not apply the AppView limit to other proxied services', async () => {
    appview.hold()
    const inFlight = getLikes()
    await appview.waitForArrivals(1)
    const queued = getLikes()
    await sleep(200)

    // The AppView limiter is now full: one in flight, one queued.
    const other = await pdsGet(
      network.pds.url,
      'app.bsky.feed.getLikes',
      { uri: 'at://did:example:alice/app.bsky.feed.post/1' },
      { accessJwt, proxy: `${otherServiceDid}#proxy_test` },
    )
    expect(other.status).toBe(200)
    await other.text()
    expect(otherService.arrivals).toHaveLength(1)

    appview.release()
    const responses = await Promise.all([inFlight, queued])
    await Promise.all(responses.map((r) => r.text()))
  })
})

/**
 * A PDS whose configured AppView is `appview`. `pds` takes ServerEnvironment
 * keys (e.g. `bskyAppViewMaxRequestsPerSecond`), which override the defaults
 * set by TestPds.create().
 */
async function createNetworkWithAppView(
  appview: FakeUpstream,
  pds: TestServerParams['pds'] = {},
): Promise<TestNetworkNoAppView> {
  return TestNetworkNoAppView.create({
    pds: {
      bskyAppViewUrl: appview.url,
      bskyAppViewDid: APPVIEW_DID,
      ...pds,
    },
  })
}

async function pdsGet(
  pdsUrl: string,
  nsid: string,
  params: Record<string, string>,
  opts: { accessJwt?: string; proxy?: string } = {},
): Promise<Response> {
  const url = new URL(`/xrpc/${nsid}`, pdsUrl)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const headers = new Headers()
  if (opts.accessJwt) headers.set('authorization', `Bearer ${opts.accessJwt}`)
  if (opts.proxy) headers.set('atproto-proxy', opts.proxy)
  return fetch(url, { headers })
}

async function pdsPost(
  pdsUrl: string,
  nsid: string,
  body: Record<string, unknown>,
  opts: { accessJwt?: string } = {},
): Promise<Response> {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (opts.accessJwt) headers.set('authorization', `Bearer ${opts.accessJwt}`)
  return fetch(new URL(`/xrpc/${nsid}`, pdsUrl), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function registerServiceDid(
  plcClient: plc.Client,
  keypair: Keypair,
  serviceId: string,
  endpoint: string,
): Promise<string> {
  const op = await plc.signOperation(
    {
      type: 'plc_operation',
      rotationKeys: [keypair.did()],
      alsoKnownAs: [],
      verificationMethods: {},
      services: {
        [serviceId]: { type: 'TestAtprotoService', endpoint },
      },
      prev: null,
    },
    keypair,
  )
  const did = await plc.didForCreateOp(op)
  await plcClient.sendOperation(did, op)
  return did
}

type Arrival = {
  method: string
  nsid: string
  /** performance.now() when the request arrived. */
  at: number
  // Only whether the PDS sent a service-auth JWT; the token itself is never
  // recorded, so it cannot end up in test output.
  hasAuthorization: boolean
}

/**
 * HTTP server standing in for an XRPC service. Every request gets 200 with
 * `{"nsid": "<nsid>"}`. After hold(), responses wait until release().
 */
class FakeUpstream {
  readonly arrivals: Arrival[] = []
  private holding = false
  private held: Array<() => void> = []
  private waiters: Array<{ count: number; resolve: () => void }> = []

  private constructor(
    private readonly server: http.Server,
    readonly url: string,
  ) {}

  static async start(): Promise<FakeUpstream> {
    const server = http.createServer()
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (address === null || typeof address === 'string') {
      throw new Error('expected a TCP address')
    }
    // Nothing can know the port before this point, so no request is missed.
    const upstream = new FakeUpstream(
      server,
      `http://127.0.0.1:${address.port}`,
    )
    server.on('request', (req, res) => upstream.onRequest(req, res))
    return upstream
  }

  get heldCount(): number {
    return this.held.length
  }

  arrivalsFor(nsid: string): Arrival[] {
    return this.arrivals.filter((a) => a.nsid === nsid)
  }

  /** Responses to requests arriving from now on wait for release(). */
  hold(): void {
    this.holding = true
  }

  /**
   * Sends the `count` oldest held responses, or all of them and stops holding
   * when `count` is omitted.
   */
  release(count?: number): void {
    if (count === undefined) this.holding = false
    const toSend = this.held.splice(0, count ?? this.held.length)
    for (const send of toSend) send()
  }

  /** Resolves once at least `count` requests have arrived since reset(). */
  waitForArrivals(count: number): Promise<void> {
    if (this.arrivals.length >= count) return Promise.resolve()
    return new Promise((resolve) => this.waiters.push({ count, resolve }))
  }

  reset(): void {
    this.release()
    this.arrivals.length = 0
  }

  async close(): Promise<void> {
    this.release()
    const closed = once(this.server, 'close')
    this.server.close()
    this.server.closeAllConnections()
    await closed
  }

  private onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? '/', this.url)
    const nsid = url.pathname.replace(/^\/xrpc\//, '')
    this.arrivals.push({
      method: req.method ?? '',
      nsid,
      at: performance.now(),
      hasAuthorization: req.headers.authorization !== undefined,
    })
    this.waiters = this.waiters.filter((w) => {
      if (this.arrivals.length < w.count) return true
      w.resolve()
      return false
    })

    const send = () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ nsid }))
    }
    if (this.holding) this.held.push(send)
    else send()
  }
}
