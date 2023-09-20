import AtpAgent, { AppBskyFeedPost } from '@atproto/api'
import { runTestServer, forSnapshot, TestServerInfo } from '../_util'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'

describe('pds posts views', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'views_posts',
    })
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await server.processAll()
  })

  afterAll(async () => {
    await server.close()
  })

  it('fetches posts', async () => {
    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][1].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      sc.posts[sc.dids.carol][0].ref.uriStr,
      sc.posts[sc.dids.dan][1].ref.uriStr,
      sc.replies[sc.dids.alice][0].ref.uriStr,
    ]
    const posts = await agent.api.app.bsky.feed.getPosts(
      { uris },
      { headers: sc.getHeaders(sc.dids.alice) },
    )

    expect(posts.data.posts.length).toBe(uris.length)
    expect(forSnapshot(posts.data.posts)).toMatchSnapshot()
  })

  it('handles repeat uris', async () => {
    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
    ]

    const posts = await agent.api.app.bsky.feed.getPosts(
      { uris },
      { headers: sc.getHeaders(sc.dids.alice) },
    )

    expect(posts.data.posts.length).toBe(2)
    const receivedUris = posts.data.posts.map((p) => p.uri).sort()
    const expected = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
    ].sort()
    expect(receivedUris).toEqual(expected)
  })

  it('allows for creating posts with tags', async () => {
    const post: AppBskyFeedPost.Record = {
      text: 'hello world',
      tags: ['javascript', 'hehe'],
      createdAt: new Date().toISOString(),
    }

    const { uri } = await agent.api.app.bsky.feed.post.create(
      { repo: sc.dids.alice },
      post,
      sc.getHeaders(sc.dids.alice),
    )
    const { data } = await agent.api.app.bsky.feed.getPosts(
      { uris: [uri] },
      { headers: sc.getHeaders(sc.dids.alice) },
    )

    expect(data.posts.length).toBe(1)
  })
})
