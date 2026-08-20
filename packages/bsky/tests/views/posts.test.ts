import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppBskyEmbedGallery, type AtpAgent, ids } from '@atproto/api'
import { type SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { currentDatetimeString } from '@atproto/lex'
import { app } from '../../src/lexicons/index.js'
import { forSnapshot, stripViewerFromPost } from '../_util.js'

describe('pds posts views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_posts',
    })
    agent = network.bsky.getAgent()
    sc = network.getSeedClient()
    await basicSeed(sc)

    await sc.createAccount('eve', {
      handle: 'eve.test',
      email: 'eve@eve.com',
      password: 'hunter2',
    })
    await sc.post(sc.dids.eve, 'post will go down')

    await sc.createAccount('frankie', {
      handle: 'frankie.test',
      email: 'frankie@frankie.com',
      password: 'hunter2',
    })
    await sc.post(sc.dids.frankie, 'account will go down')

    await network.processAll()

    await network.bsky.ctx.dataplane.takedownRecord({
      recordUri: sc.posts[sc.dids.eve][0].ref.uriStr,
    })

    await network.bsky.ctx.dataplane.takedownActor({
      did: sc.dids.frankie,
    })
  })

  beforeEach(async () => network.processAll())
  afterAll(async () => network?.close())

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

  it(`omits not-found posts`, async () => {
    // This is a valid post AT-URI (from a prod post), but it shouldn't exist in the test env.
    const badPostUri =
      'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3m5yqexldn22q'

    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][1].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      badPostUri,
    ]
    const posts = await agent.app.bsky.feed.getPosts(
      { uris },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )

    expect(posts.data.posts.length).toBe(uris.length - 1)
    expect(posts.data.posts.map((p) => p.uri).includes(badPostUri)).toBe(false)
  })

  it(`omits taken-down posts`, async () => {
    // Taken-down post.
    const badPostUri = sc.posts[sc.dids.eve][0].ref.uriStr

    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][1].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      badPostUri,
    ]
    const posts = await agent.app.bsky.feed.getPosts(
      { uris },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )

    expect(posts.data.posts.length).toBe(uris.length - 1)
    expect(posts.data.posts.map((p) => p.uri).includes(badPostUri)).toBe(false)
  })

  it(`omits posts by taken-down accounts`, async () => {
    // Taken-down account.
    const badPostUri = sc.posts[sc.dids.frankie][0].ref.uriStr

    const uris = [
      sc.posts[sc.dids.alice][0].ref.uriStr,
      sc.posts[sc.dids.alice][1].ref.uriStr,
      sc.posts[sc.dids.bob][0].ref.uriStr,
      badPostUri,
    ]
    const posts = await agent.app.bsky.feed.getPosts(
      { uris },
      {
        headers: await network.serviceHeaders(
          sc.dids.alice,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )

    expect(posts.data.posts.length).toBe(uris.length - 1)
    expect(posts.data.posts.map((p) => p.uri).includes(badPostUri)).toBe(false)
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
    const post: Omit<app.bsky.feed.post.Main, '$type'> = {
      text: 'hello world',
      tags: ['javascript', 'hehe'],
      createdAt: currentDatetimeString(),
    }

    const { uri } = await sc.client.create(app.bsky.feed.post, post, {
      repo: sc.dids.alice,
      headers: sc.getHeaders(sc.dids.alice),
    })

    await network.processAll()

    const { data } = await agent.api.app.bsky.feed.getPosts({ uris: [uri] })

    expect(data.posts.length).toBe(1)
    // @ts-ignore we know it's a post record
    expect(data.posts[0].record.tags).toEqual(['javascript', 'hehe'])
  })

  it('embeds video.', async () => {
    const { body: video } = await sc.client.uploadBlob(
      Buffer.from('notarealvideo'),
      {
        headers: sc.getHeaders(sc.dids.alice),
        encoding: 'video/mp4',
      },
    )
    const { uri } = await sc.client.create(
      app.bsky.feed.post,
      {
        text: 'video',
        createdAt: currentDatetimeString(),
        embed: {
          $type: 'app.bsky.embed.video',
          video: video.blob,
          alt: 'alt text',
          aspectRatio: { height: 3, width: 4 },
        },
      },
      { repo: sc.dids.alice, headers: sc.getHeaders(sc.dids.alice) },
    )
    await network.processAll()
    const { data } = await agent.app.bsky.feed.getPosts({ uris: [uri] })
    expect(data.posts.length).toBe(1)
    expect(forSnapshot(data.posts[0])).toMatchSnapshot()
  })

  it('embeds video with record.', async () => {
    const { body: video } = await sc.client.uploadBlob(
      Buffer.from('notarealvideo'),
      {
        headers: sc.getHeaders(sc.dids.alice),
        encoding: 'video/mp4',
      },
    )
    const embedRecord = await sc.client.create(
      app.bsky.feed.post,
      {
        text: 'embedded',
        createdAt: currentDatetimeString(),
      },
      { repo: sc.dids.alice, headers: sc.getHeaders(sc.dids.alice) },
    )
    const { uri } = await sc.client.create(
      app.bsky.feed.post,
      {
        text: 'video',
        createdAt: currentDatetimeString(),
        embed: {
          $type: 'app.bsky.embed.recordWithMedia',
          record: {
            record: {
              uri: embedRecord.uri,
              cid: embedRecord.cid,
            },
          },
          media: {
            $type: 'app.bsky.embed.video',
            video: video.blob,
            alt: 'alt text',
            aspectRatio: { height: 3, width: 4 },
          },
        },
      },
      { repo: sc.dids.alice, headers: sc.getHeaders(sc.dids.alice) },
    )
    await network.processAll()
    const { data } = await agent.app.bsky.feed.getPosts({ uris: [uri] })
    expect(data.posts.length).toBe(1)
    expect(forSnapshot(data.posts[0])).toMatchSnapshot()
  })

  it('embeds gallery.', async () => {
    const img1 = await sc.uploadFile(
      sc.dids.alice,
      '../dev-env/assets/key-landscape-small.jpg',
      'image/jpeg',
    )
    const img2 = await sc.uploadFile(
      sc.dids.alice,
      '../dev-env/assets/key-portrait-small.jpg',
      'image/jpeg',
    )
    const { uri } = await sc.client.create(
      app.bsky.feed.post,
      {
        text: 'gallery',
        createdAt: currentDatetimeString(),
        embed: {
          $type: 'app.bsky.embed.gallery',
          items: [
            {
              $type: 'app.bsky.embed.gallery#image',
              image: img1.image,
              alt: 'landscape',
              aspectRatio: { width: 4, height: 3 },
            },
            {
              $type: 'app.bsky.embed.gallery#image',
              image: img2.image,
              alt: 'portrait',
              aspectRatio: { width: 3, height: 4 },
            },
          ],
        },
      },
      { repo: sc.dids.alice, headers: sc.getHeaders(sc.dids.alice) },
    )
    await network.processAll()
    const { data } = await agent.app.bsky.feed.getPosts({ uris: [uri] })
    expect(data.posts.length).toBe(1)
    expect(forSnapshot(data.posts[0])).toMatchSnapshot()
  })

  it('embeds gallery with record.', async () => {
    const img = await sc.uploadFile(
      sc.dids.alice,
      '../dev-env/assets/key-landscape-small.jpg',
      'image/jpeg',
    )
    const embedRecord = await sc.client.create(
      app.bsky.feed.post,
      {
        text: 'embedded',
        createdAt: currentDatetimeString(),
      },
      { repo: sc.dids.alice, headers: sc.getHeaders(sc.dids.alice) },
    )
    const { uri } = await sc.client.create(
      app.bsky.feed.post,
      {
        text: 'gallery + record',
        createdAt: currentDatetimeString(),
        embed: {
          $type: 'app.bsky.embed.recordWithMedia',
          record: {
            record: {
              uri: embedRecord.uri,
              cid: embedRecord.cid,
            },
          },
          media: {
            $type: 'app.bsky.embed.gallery',
            items: [
              {
                $type: 'app.bsky.embed.gallery#image',
                image: img.image,
                alt: 'landscape',
                aspectRatio: { width: 4, height: 3 },
              },
            ],
          },
        },
      },
      { repo: sc.dids.alice, headers: sc.getHeaders(sc.dids.alice) },
    )
    await network.processAll()
    const { data } = await agent.app.bsky.feed.getPosts({ uris: [uri] })
    expect(data.posts.length).toBe(1)
    expect(forSnapshot(data.posts[0])).toMatchSnapshot()
  })

  it('truncates gallery view to soft limit of 10 items.', async () => {
    const img = await sc.uploadFile(
      sc.dids.alice,
      '../dev-env/assets/key-landscape-small.jpg',
      'image/jpeg',
    )
    const items: app.bsky.embed.gallery.Main['items'] = Array.from(
      { length: 11 },
      (_, i) => ({
        $type: 'app.bsky.embed.gallery#image',
        image: img.image,
        alt: `item ${i}`,
        aspectRatio: { width: 4, height: 3 },
      }),
    )
    const { uri } = await sc.client.create(
      app.bsky.feed.post,
      {
        text: 'oversize gallery',
        createdAt: currentDatetimeString(),
        embed: {
          $type: 'app.bsky.embed.gallery',
          items,
        },
      },
      { repo: sc.dids.alice, headers: sc.getHeaders(sc.dids.alice) },
    )
    await network.processAll()
    const { data } = await agent.app.bsky.feed.getPosts({ uris: [uri] })
    expect(data.posts.length).toBe(1)
    const embed = data.posts[0].embed
    if (!embed || !AppBskyEmbedGallery.isView(embed)) {
      throw new Error('expected gallery view')
    }
    expect(embed.items).toHaveLength(10)
    // Verify the AppView keeps the head of the items list (not the tail).
    embed.items.forEach((item, i) => {
      if (AppBskyEmbedGallery.isViewImage(item)) {
        expect(item.alt).toBe(`item ${i}`)
      }
    })
  })
})
