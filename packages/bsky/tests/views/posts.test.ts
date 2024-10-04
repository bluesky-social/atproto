import { AppBskyFeedPost, AtpAgent } from '@atproto/api'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import { forSnapshot, stripViewerFromPost } from '../_util'
import { RecordEmbed, VideoEmbed } from '../../src/views/types'
import { RecordWithMedia } from '../../dist/views/types'
import { ids } from '../../src/lexicon/lexicons'

describe('pds posts views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_posts',
    })
    agent = network.bsky.getClient()
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
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
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )

    expect(posts.data.posts.length).toBe(uris.length)
    expect(forSnapshot(posts.data.posts)).toMatchSnapshot()
  })

  it('fetches posts unauthed', async () => {
    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][1].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      sc.posts[sc.dids.carol][0].ref.uriStr,
      sc.posts[sc.dids.dan][1].ref.uriStr,
      sc.replies[sc.dids.alice][0].ref.uriStr,
    ]

    const authed = await agent.api.app.bsky.feed.getPosts(
      { uris },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )
    const unauthed = await agent.api.app.bsky.feed.getPosts({
      uris,
    })
    const stripped = authed.data.posts.map((p) => stripViewerFromPost(p))
    expect(unauthed.data.posts).toEqual(stripped)
  })

  it('handles repeat uris', async () => {
    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
    ]

    const posts = await agent.api.app.bsky.feed.getPosts({ uris })

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

    const { uri } = await pdsAgent.api.app.bsky.feed.post.create(
      { repo: sc.dids.alice },
      post,
      sc.getHeaders(sc.dids.alice),
    )

    await network.processAll()

    const { data } = await agent.api.app.bsky.feed.getPosts({ uris: [uri] })

    expect(data.posts.length).toBe(1)
    // @ts-ignore we know it's a post record
    expect(data.posts[0].record.tags).toEqual(['javascript', 'hehe'])
  })

  it('embeds video.', async () => {
    const { data: video } = await pdsAgent.api.com.atproto.repo.uploadBlob(
      Buffer.from('notarealvideo'),
      {
        headers: sc.getHeaders(sc.dids.alice),
        encoding: 'image/mp4',
      },
    )
    const { uri } = await pdsAgent.api.app.bsky.feed.post.create(
      { repo: sc.dids.alice },
      {
        text: 'video',
        createdAt: new Date().toISOString(),
        embed: {
          $type: 'app.bsky.embed.video',
          video: video.blob,
          alt: 'alt text',
          aspectRatio: { height: 3, width: 4 },
        } satisfies VideoEmbed,
      },
      sc.getHeaders(sc.dids.alice),
    )
    await network.processAll()
    const { data } = await agent.app.bsky.feed.getPosts({ uris: [uri] })
    expect(data.posts.length).toBe(1)
    expect(forSnapshot(data.posts[0])).toMatchSnapshot()
  })

  it('embeds video with record.', async () => {
    const { data: video } = await pdsAgent.api.com.atproto.repo.uploadBlob(
      Buffer.from('notarealvideo'),
      {
        headers: sc.getHeaders(sc.dids.alice),
        encoding: 'image/mp4',
      },
    )
    const embedRecord = await pdsAgent.api.app.bsky.feed.post.create(
      { repo: sc.dids.alice },
      {
        text: 'embedded',
        createdAt: new Date().toISOString(),
      },
      sc.getHeaders(sc.dids.alice),
    )
    const { uri } = await pdsAgent.api.app.bsky.feed.post.create(
      { repo: sc.dids.alice },
      {
        text: 'video',
        createdAt: new Date().toISOString(),
        embed: {
          $type: 'app.bsky.embed.recordWithMedia',
          record: {
            record: {
              uri: embedRecord.uri,
              cid: embedRecord.cid,
            },
          } satisfies RecordEmbed,
          media: {
            $type: 'app.bsky.embed.video',
            video: video.blob,
            alt: 'alt text',
            aspectRatio: { height: 3, width: 4 },
          } satisfies VideoEmbed,
        } satisfies RecordWithMedia,
      },
      sc.getHeaders(sc.dids.alice),
    )
    await network.processAll()
    const { data } = await agent.app.bsky.feed.getPosts({ uris: [uri] })
    expect(data.posts.length).toBe(1)
    expect(forSnapshot(data.posts[0])).toMatchSnapshot()
  })
})
