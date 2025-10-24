import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

describe('post views w/ debug field', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_posts_debug',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterEach(() => {
    network.bsky.ctx.cfg.debugFieldAllowedDids.clear()
  })

  afterAll(async () => {
    await network.close()
  })

  it(`does not include debug field for unauthed requests`, async () => {
    network.bsky.ctx.cfg.debugFieldAllowedDids.add(sc.dids.bob)

    const uris = [sc.posts[sc.dids.alice][0].ref.uriStr]
    const posts = await agent.api.app.bsky.feed.getPosts({ uris })

    const post = posts.data.posts.at(0)
    expect(post?.debug).not.toBeDefined()
  })

  it(`includes debug field for configured user`, async () => {
    network.bsky.ctx.cfg.debugFieldAllowedDids.add(sc.dids.bob)

    const uris = [sc.posts[sc.dids.alice][0].ref.uriStr]
    const posts = await agent.api.app.bsky.feed.getPosts(
      { uris },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )

    const post = posts.data.posts.at(0)
    expect(post?.debug).toBeDefined()
    expect(typeof post?.debug).toBe('object')
  })

  it(`doesn't include debug field for other users`, async () => {
    network.bsky.ctx.cfg.debugFieldAllowedDids.add(sc.dids.carol)

    const uris = [sc.posts[sc.dids.alice][0].ref.uriStr]
    const posts = await agent.api.app.bsky.feed.getPosts(
      { uris },
      {
        headers: await network.serviceHeaders(
          sc.dids.bob,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )

    const post = posts.data.posts.at(0)
    expect(post?.debug).not.toBeDefined()
  })
})
