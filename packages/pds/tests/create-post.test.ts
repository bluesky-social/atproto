import {
  AppBskyFeedPost,
  AppBskyRichtextFacet,
  AtUri,
  AtpAgent,
  RichText,
  Un$Typed,
} from '@atproto/api'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import basicSeed from './seeds/basic'

describe('pds posts record creation', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'views_posts',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('allows for creating posts with tags', async () => {
    const post: Un$Typed<AppBskyFeedPost.Record> = {
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

    const post: Un$Typed<AppBskyFeedPost.Record> = {
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
