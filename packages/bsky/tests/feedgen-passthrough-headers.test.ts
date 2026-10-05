import assert from 'node:assert'
import { once } from 'node:events'
import type { IncomingHttpHeaders, Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { type AtpAgent, ids } from '@atproto/api'
import { type TestFeedGen, TestNetwork, basicSeed } from '@atproto/dev-env'
import { type DidString, currentDatetimeString } from '@atproto/lex'
import { app } from '@atproto/pds'
import { AtUri } from '@atproto/syntax'
import { createServer as createXrpcServer } from '@atproto/xrpc-server'
import { Gate } from '../src/feature-gates/gates.js'

let network: TestNetwork
let agent: AtpAgent
let pdsAgent: AtpAgent
let feedGen: TestFeedGen
let alice: DidString
let feedUri: string
let feedGenRequestHeaders: IncomingHttpHeaders | undefined
let irisRequestHeaders: IncomingHttpHeaders | undefined
let irisServer: HttpServer | undefined

beforeAll(async () => {
  const iris = createXrpcServer()
  iris.add(app.bsky.feed.getFeedSkeleton, async ({ req }) => {
    irisRequestHeaders = req.headers
    return {
      encoding: 'application/json',
      body: { feed: [] } satisfies app.bsky.feed.getFeedSkeleton.$OutputBody,
    }
  })
  irisServer = iris.listen(0)
  await once(irisServer, 'listening')
  const irisUrl = `http://localhost:${(irisServer.address() as AddressInfo).port}`

  network = await TestNetwork.create({
    dbPostgresSchema: 'bsky_feedgen_passthrough_headers',
    bsky: {
      irisUrl,
      irisFeedUris: new Set(),
      irisStagingUrl: irisUrl,
      irisStagingFeedUris: new Set(),
    },
  })
  agent = network.bsky.getAgent()
  pdsAgent = network.pds.getAgent()
  const sc = network.getSeedClient()
  await basicSeed(sc)
  await network.processAll()

  alice = sc.dids.alice
  feedUri = AtUri.make(alice, 'app.bsky.feed.generator', 'headers').toString()
  feedGen = await network.createFeedGen({
    [feedUri]: async ({ req }) => {
      feedGenRequestHeaders = req.headers
      return {
        encoding: 'application/json',
        body: { feed: [] } satisfies app.bsky.feed.getFeedSkeleton.$OutputBody,
      }
    },
  })
  await pdsAgent.api.app.bsky.feed.generator.create(
    { repo: alice, rkey: 'headers' },
    {
      did: feedGen.did,
      displayName: 'Headers test feed',
      createdAt: currentDatetimeString(),
    },
    sc.getHeaders(alice),
  )
  await network.processAll()
})

beforeEach(() => {
  network.bsky.ctx.cfg.bskyFeedgenDids.clear()
  network.bsky.ctx.cfg.irisFeedUris?.clear()
  network.bsky.ctx.cfg.irisStagingFeedUris?.clear()
  feedGenRequestHeaders = undefined
  irisRequestHeaders = undefined
})

afterAll(async () => {
  try {
    await network?.close()
  } finally {
    const server = irisServer
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    }
  }
})

const passthroughInputHeaders = {
  'x-atproto-device-id': 'device-123',
  'x-atproto-session-id': 'session-456',
  'x-bsky-topics': 'topic-one,topic-two',
  'accept-language': 'fr-CA',
  'user-agent': 'caller-test-agent',
}

async function requestFeed() {
  const auth = await network.serviceHeaders(
    alice,
    ids.AppBskyFeedGetFeedSkeleton,
    feedGen.did,
  )
  await agent.api.app.bsky.feed.getFeed(
    { feed: feedUri },
    { headers: { ...auth, ...passthroughInputHeaders } },
  )
  return auth.authorization
}

function expectBaseHeaders(
  headers: IncomingHttpHeaders,
  authorization: string,
) {
  expect(headers.authorization).toBe(authorization)
  expect(headers['accept-language']).toBe('fr-CA')
  expect(headers['user-agent']).toBe('BskyAppView')
}

function expectPassthroughHeaders(headers: IncomingHttpHeaders) {
  expect(headers['x-atproto-device-id']).toBe('device-123')
  expect(headers['x-atproto-session-id']).toBe('session-456')
  expect(headers['x-bsky-topics']).toBe('topic-one,topic-two')
  expect(headers['x-atproto-bsky-topics']).toBe('topic-one,topic-two')
}

function expectNoPassthroughHeaders(headers: IncomingHttpHeaders) {
  expect(headers).not.toHaveProperty('x-atproto-device-id')
  expect(headers).not.toHaveProperty('x-atproto-session-id')
  expect(headers).not.toHaveProperty('x-bsky-topics')
  expect(headers).not.toHaveProperty('x-atproto-bsky-topics')
}

describe('getFeed passthrough headers', () => {
  it('forwards passthrough headers to an allowlisted generator service', async () => {
    network.bsky.ctx.cfg.bskyFeedgenDids.add(feedGen.did)

    const authorization = await requestFeed()
    assert(feedGenRequestHeaders)
    expectBaseHeaders(feedGenRequestHeaders, authorization)
    expectPassthroughHeaders(feedGenRequestHeaders)
  })

  it('does not forward passthrough headers to an unallowlisted generator service', async () => {
    network.bsky.ctx.cfg.bskyFeedgenDids.add('did:example:other-feedgen')

    const authorization = await requestFeed()
    assert(feedGenRequestHeaders)
    expectBaseHeaders(feedGenRequestHeaders, authorization)
    expectNoPassthroughHeaders(feedGenRequestHeaders)
  })

  it('fails closed with an empty generator allowlist', async () => {
    const authorization = await requestFeed()
    assert(feedGenRequestHeaders)
    expectBaseHeaders(feedGenRequestHeaders, authorization)
    expectNoPassthroughHeaders(feedGenRequestHeaders)
  })

  it('does not treat the feed publisher DID as the generator service DID', async () => {
    network.bsky.ctx.cfg.bskyFeedgenDids.add(alice)

    const authorization = await requestFeed()
    assert(feedGenRequestHeaders)
    expectBaseHeaders(feedGenRequestHeaders, authorization)
    expectNoPassthroughHeaders(feedGenRequestHeaders)
  })

  it.each(['Iris', 'Iris staging'])(
    'does not let the %s routing override bypass the generator allowlist',
    async (route) => {
      if (route === 'Iris') {
        network.bsky.ctx.cfg.irisFeedUris?.add(feedUri)
      } else {
        network.bsky.ctx.cfg.irisStagingFeedUris?.add(feedUri)
      }

      using featureGate = vi
        .spyOn(network.bsky.ctx.featureGatesClient, 'scope')
        .mockImplementation(() => ({
          Gate,
          checkGate: (gate) => gate === Gate.IrisFeed,
          checkGates: (gates) =>
            new Map(gates.map((gate) => [gate, gate === Gate.IrisFeed])),
        }))

      const authorization = await requestFeed()
      assert(irisRequestHeaders)
      expectBaseHeaders(irisRequestHeaders, authorization)
      expectNoPassthroughHeaders(irisRequestHeaders)

      network.bsky.ctx.cfg.bskyFeedgenDids.add(feedGen.did)
      irisRequestHeaders = undefined
      await requestFeed()
      assert(irisRequestHeaders)
      expectPassthroughHeaders(irisRequestHeaders)
      expect(featureGate).toHaveBeenCalled()
    },
  )
})
