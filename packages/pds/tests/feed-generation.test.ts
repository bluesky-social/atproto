import { AtpAgent } from '@atproto/api'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { TestFeedGen } from '@atproto/dev-env/src/feed-gen'

describe('feed generation', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let gen: TestFeedGen

  let alice: string
  let feedUri: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'feed_generation',
    })
    agent = network.pds.getClient()
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await network.pds.ctx.backgroundQueue.processAll()
    gen = await network.createFeedGen(async ({ req }) => {
      const feed = [
        {
          post: sc.posts[sc.dids.alice][0].ref.uriStr,
        },
        {
          post: sc.posts[sc.dids.bob][0].ref.uriStr,
        },
      ]
      return {
        encoding: 'application/json',
        body: {
          feed,
          $auth: jwtBody(req.headers.authorization), // for testing purposes
        },
      }
    })
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  it('feed gen records can be created', async () => {
    const res = await agent.api.app.bsky.feed.generator.create(
      { repo: alice, rkey: 'test-feed' },
      {
        did: gen.did,
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(alice),
    )
    feedUri = res.uri
  })

  it('resolves feed contents', async () => {
    const feed = await agent.api.app.bsky.feed.getFeed(
      { feed: feedUri },
      { headers: sc.getHeaders(alice) },
    )
    expect(feed.data.feed.length).toEqual(2)
    expect(feed.data.feed[0].post.uri).toEqual(
      sc.posts[sc.dids.alice][0].ref.uriStr,
    )
    expect(feed.data.feed[1].post.uri).toEqual(
      sc.posts[sc.dids.bob][0].ref.uriStr,
    )
  })
})

const jwtBody = (authHeader?: string): Record<string, unknown> | undefined => {
  if (!authHeader?.startsWith('Bearer')) return undefined
  const jwt = authHeader.replace('Bearer ', '')
  const [, bodyb64] = jwt.split('.')
  const body = JSON.parse(Buffer.from(bodyb64, 'base64').toString())
  if (!body || typeof body !== 'object') return undefined
  return body
}
