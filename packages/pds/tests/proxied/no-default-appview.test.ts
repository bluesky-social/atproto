import { AtUri, type AtpAgent } from '@atproto/api'
import { type SeedClient, TestNetwork } from '@atproto/dev-env'
import { InvalidRequestError } from '@atproto/xrpc-server'
import basicSeed from '../seeds/basic.js'
import { ProxyServer } from './proxy-server.js'

/**
 * A PDS with no `PDS_BSKY_APP_VIEW_URL`: nothing is proxied unless the client
 * names a target, while everything the PDS owns is still served.
 */
describe('pds without a default app view', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let feedUri: AtUri
  let appView: ProxyServer

  beforeAll(async () => {
    appView = await ProxyServer.listen('bsky_appview')
    network = await TestNetwork.create({
      dbPostgresSchema: 'proxy_no_default_appview',
      bsky: { alternateAudienceDids: [appView.did] },
      pds: {
        bskyAppViewUrl: undefined,
        bskyAppViewDid: undefined,
        bskyAppViewCdnUrlPattern: undefined,
      },
    })
    agent = network.pds.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc, { addModLabels: network.bsky })

    feedUri = AtUri.make(sc.dids.alice, 'app.bsky.feed.generator', 'mutuals')
    const feedGen = await network.createFeedGen({
      [feedUri.toString()]: ({ params }) => {
        if (params.feed !== feedUri.toString()) {
          throw new InvalidRequestError('Unknown feed')
        }
        return {
          encoding: 'application/json',
          body: {
            feed: [
              { post: sc.posts[sc.dids.alice][0].ref.uriStr },
              { post: sc.posts[sc.dids.carol][0].ref.uriStr },
            ],
          },
        }
      },
    })
    await agent.api.app.bsky.feed.generator.create(
      { repo: sc.dids.alice, rkey: feedUri.rkey },
      {
        did: feedGen.did,
        displayName: 'Test feed',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.alice),
    )
    await network.processAll()

    appView.options.upstream = network.bsky.url
    await appView.register(network.pds.ctx.plcClient)
  })

  afterAll(async () => {
    await appView?.close()
    await network?.close()
  })

  it('is not configured with an app view', () => {
    expect(network.pds.ctx.cfg.bskyAppView).toBeNull()
    expect(network.pds.ctx.bskyAppView).toBeUndefined()
  })

  it('serves preferences locally', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          { $type: 'app.bsky.actor.defs#adultContentPref', enabled: true },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data.preferences).toEqual([
      { $type: 'app.bsky.actor.defs#adultContentPref', enabled: true },
    ])
  })

  it('serves local records without falling through', async () => {
    const post = sc.posts[sc.dids.alice][0].ref
    const { data } = await agent.api.com.atproto.repo.getRecord({
      repo: post.uri.host,
      collection: post.uri.collection,
      rkey: post.uri.rkey,
    })
    expect(data.uri).toEqual(post.uriStr)

    await expect(
      agent.api.com.atproto.repo.getRecord({
        repo: post.uri.host,
        collection: post.uri.collection,
        rkey: 'missing',
      }),
    ).rejects.toMatchObject({ error: 'RecordNotFound' })

    await expect(
      agent.api.com.atproto.repo.getRecord({
        repo: 'did:plc:notlocalnotlocalnotlocal',
        collection: post.uri.collection,
        rkey: post.uri.rkey,
      }),
    ).rejects.toMatchObject({
      error: 'InvalidRequest',
      message: 'Could not locate record',
    })
  })

  it('rejects untargeted app view requests', async () => {
    await expect(
      agent.api.app.bsky.feed.getTimeline(
        {},
        { headers: sc.getHeaders(sc.dids.alice) },
      ),
    ).rejects.toMatchObject({
      error: 'InvalidRequest',
      message: 'No service configured for app.bsky.feed.getTimeline',
    })
    await expect(
      agent.api.app.bsky.feed.getFeed(
        { feed: feedUri.toString() },
        { headers: sc.getHeaders(sc.dids.alice) },
      ),
    ).rejects.toMatchObject({
      error: 'InvalidRequest',
      message: 'No service configured for app.bsky.feed.getFeed',
    })
  })

  it('proxies targeted app view requests', async () => {
    const headers = {
      ...sc.getHeaders(sc.dids.alice),
      'atproto-proxy': `${appView.did}#bsky_appview`,
    }
    const { data: profile } = await agent.api.app.bsky.actor.getProfile(
      { actor: sc.dids.alice },
      { headers },
    )
    expect(profile.did).toEqual(sc.dids.alice)

    const { data: feed } = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri.toString() },
      { headers },
    )
    expect(feed.feed.map((item) => item.post.uri)).toEqual([
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.carol][0].ref.uriStr,
    ])

    const paths = appView.requests.map((r) => r.url.split('?')[0])
    expect(paths).toEqual([
      '/xrpc/app.bsky.actor.getProfile',
      '/xrpc/com.atproto.repo.getRecord',
      '/xrpc/app.bsky.feed.getFeed',
    ])
  })
})
