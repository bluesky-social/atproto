import AtpAgent, {
  AppBskyFeedPost,
  AtUri,
  RichText,
  AppBskyRichtextFacet,
} from '@atproto/api'
import { runTestServer, TestServerInfo } from './_util'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'

describe('pds posts record creation', () => {
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

  it('allows for creating posts with tags', async () => {
    const post: AppBskyFeedPost.Record = {
      text: 'hello world',
      tags: ['javascript', 'hehe'],
      createdAt: new Date().toISOString(),
    }

    const res = await agent.api.app.bsky.feed.post.create(
      { repo: sc.dids.alice },
      post,
      sc.getHeaders(sc.dids.alice),
    )
    const { value: record } = await agent.api.app.bsky.feed.post.get({
      repo: sc.dids.alice,
      rkey: new AtUri(res.uri).rkey,
    })

    expect(record).toBeTruthy()
    expect(record.tags).toEqual(['javascript', 'hehe'])
  })

  it('handles RichText tag facets as well', async () => {
    const rt = new RichText({ text: 'hello #world' })
    await rt.detectFacets(agent)

    const post: AppBskyFeedPost.Record = {
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    }

    const res = await agent.api.app.bsky.feed.post.create(
      { repo: sc.dids.alice },
      post,
      sc.getHeaders(sc.dids.alice),
    )
    const { value: record } = await agent.api.app.bsky.feed.post.get({
      repo: sc.dids.alice,
      rkey: new AtUri(res.uri).rkey,
    })

    expect(record).toBeTruthy()
    expect(
      record.facets?.every((f) => {
        return AppBskyRichtextFacet.isTag(f.features[0])
      }),
    ).toBeTruthy()
  })
})
