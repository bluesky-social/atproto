import AdxApi, { ServiceClient as AdxServiceClient } from '@adxp/api'
import { AdxUri } from '@adxp/common'
import { users, posts, replies } from './test-data'
import getPort from 'get-port'
import * as util from './_util'

const USE_TEST_SERVER = true

let alicePosts: AdxUri[] = []
let bobPosts: AdxUri[] = []
let carolPosts: AdxUri[] = []
let danPosts: AdxUri[] = []
let bobFollows: Record<string, AdxUri> = {}
let bobLikes: Record<string, AdxUri> = {}
let badges: AdxUri[] = []

describe('pds views', () => {
  let client: AdxServiceClient
  let closeFn: util.CloseFn | null = null

  beforeAll(async () => {
    let port: number
    if (USE_TEST_SERVER) {
      port = await getPort()
      closeFn = await util.runTestServer(port)
    } else {
      port = 2583
    }
    client = AdxApi.service(`http://localhost:${port}`)
  })

  afterAll(async () => {
    if (closeFn) {
      await closeFn()
    }
  })

  it('register users', async () => {
    await client.todo.adx.createAccount(
      {},
      { username: users.alice.name, did: users.alice.did },
    )
    await client.todo.adx.createAccount(
      {},
      { username: users.bob.name, did: users.bob.did },
    )
    await client.todo.adx.createAccount(
      {},
      { username: users.carol.name, did: users.carol.did },
    )
    await client.todo.adx.createAccount(
      {},
      { username: users.dan.name, did: users.dan.did },
    )
  })

  it('creates profiles', async () => {
    await client.todo.social.profile.create(
      { did: users.alice.did },
      {
        displayName: users.alice.displayName,
        description: users.alice.description,
      },
    )
    await client.todo.social.profile.create(
      { did: users.bob.did },
      {
        displayName: users.bob.displayName,
        description: users.bob.description,
      },
    )
  })

  it('follow people', async () => {
    const follow = async (from: string, to: string) => {
      const res = await client.todo.social.follow.create(
        { did: from },
        { subject: to, createdAt: new Date().toISOString() },
      )
      return new AdxUri(res.uri)
    }
    await follow(users.alice.did, users.bob.did)
    await follow(users.alice.did, users.carol.did)
    await follow(users.alice.did, users.dan.did)
    bobFollows[users.alice.did] = await follow(users.bob.did, users.alice.did)
    bobFollows[users.carol.did] = await follow(users.bob.did, users.carol.did)
    await follow(users.carol.did, users.alice.did)
    await follow(users.dan.did, users.bob.did)
  })

  it('makes some posts', async () => {
    const post = async (by: string, text: string, entities?: any) => {
      const res = await client.todo.social.post.create(
        { did: by },
        { text: text, entities, createdAt: new Date().toISOString() },
      )
      return new AdxUri(res.uri)
    }
    const alice0 = await post(users.alice.did, posts.alice[0])
    const bob0 = await post(users.bob.did, posts.bob[0])
    const carol0 = await post(users.carol.did, posts.carol[0])
    const dan0 = await post(users.dan.did, posts.dan[0])
    const dan1 = await post(users.dan.did, posts.dan[1], [
      {
        index: [0, 18],
        type: 'mention',
        value: users.carol.did,
      },
    ])
    const alice1 = await post(users.alice.did, posts.alice[1])
    const bob1 = await post(users.bob.did, posts.bob[1])
    const alice2 = await post(users.alice.did, posts.alice[2])
    alicePosts = [alice0, alice1, alice2]
    bobPosts = [bob0, bob1]
    carolPosts = [carol0]
    danPosts = [dan0, dan1]
  })

  it('likes a post', async () => {
    const like = async (by: string, subject: string) => {
      const res = await client.todo.social.like.create(
        { did: by },
        { subject, createdAt: new Date().toISOString() },
      )
      return new AdxUri(res.uri)
    }
    bobLikes[alicePosts[2].toString()] = await like(
      users.bob.did,
      alicePosts[1].toString(),
    )
    bobLikes[alicePosts[2].toString()] = await like(
      users.bob.did,
      alicePosts[2].toString(),
    )
    await like(users.carol.did, alicePosts[1].toString())
    await like(users.carol.did, alicePosts[2].toString())
    await like(users.dan.did, alicePosts[1].toString())
  })

  it('replies to a post', async () => {
    const reply = async (
      by: string,
      root: AdxUri,
      parent: AdxUri,
      text: string,
    ) => {
      const res = await client.todo.social.post.create(
        { did: by },
        {
          text: text,
          reply: {
            root: root.toString(),
            parent: parent.toString(),
          },
          createdAt: new Date().toISOString(),
        },
      )
      return new AdxUri(res.uri)
    }
    const bobReply = await reply(
      users.bob.did,
      alicePosts[1],
      alicePosts[1],
      replies.bob[0],
    )
    await reply(users.carol.did, alicePosts[1], alicePosts[1], replies.carol[0])
    await reply(users.alice.did, alicePosts[1], bobReply, replies.alice[0])
  })

  it('reposts a post', async () => {
    const repost = async (by: string, subject: string) => {
      const res = await client.todo.social.repost.create(
        { did: by },
        { subject, createdAt: new Date().toISOString() },
      )
      return new AdxUri(res.uri)
    }
    await repost(users.carol.did, danPosts[1].toString())
  })

  // TODO
  // it('gives badges', async () => {
  //   const badge0 = await bob.giveBadge(users.alice.did, 'tag', 'tech')
  //   const badge1 = await bob.giveBadge(users.alice.did, 'invite')
  //   badges = [badge0, badge1]
  // })

  // TODO
  // it('accepts badges', async () => {
  //   await alice.acceptBadge(badges[0])
  // })

  it('fetches liked by view', async () => {
    const view = await client.todo.social.getLikedBy({
      uri: alicePosts[1].toString(),
    })
    expect(view.data.uri).toEqual(alicePosts[1].toString())
    expect(view.data.likedBy.length).toBe(3)
    const bobLike = view.data.likedBy.find((l) => l.name === users.bob.name)
    expect(bobLike?.did).toEqual(users.bob.did)
    expect(bobLike?.displayName).toEqual(users.bob.displayName)
    expect(bobLike?.createdAt).toBeDefined()
    expect(bobLike?.indexedAt).toBeDefined()
    const carolLike = view.data.likedBy.find((l) => l.name === users.carol.name)
    expect(carolLike?.did).toEqual(users.carol.did)
    expect(carolLike?.displayName).toEqual(users.carol.displayName)
    expect(carolLike?.createdAt).toBeDefined()
    expect(carolLike?.indexedAt).toBeDefined()
    const danLike = view.data.likedBy.find((l) => l.name === users.dan.name)
    expect(danLike?.did).toEqual(users.dan.did)
    expect(danLike?.displayName).toEqual(users.dan.displayName)
    expect(danLike?.createdAt).toBeDefined()
    expect(danLike?.indexedAt).toBeDefined()
  })

  it('fetches reposted by view', async () => {
    const view = await client.todo.social.getRepostedBy({
      uri: danPosts[1].toString(),
    })
    expect(view.data.uri).toEqual(danPosts[1].toString())
    expect(view.data.repostedBy.length).toBe(1)
    const repost = view.data.repostedBy[0]
    expect(repost.did).toEqual(users.carol.did)
    expect(repost.displayName).toEqual(users.carol.displayName)
    expect(repost.createdAt).toBeDefined()
    expect(repost.indexedAt).toBeDefined()
  })

  it('fetches followers', async () => {
    const view = await client.todo.social.getUserFollowers({
      user: 'alice',
    })
    expect(view.data.subject.did).toEqual(users.alice.did)
    expect(view.data.subject.name).toEqual(users.alice.name)
    expect(view.data.subject.displayName).toEqual(users.alice.displayName)
    const bobFollow = view.data.followers.find((f) => f.name === users.bob.name)
    expect(bobFollow?.did).toEqual(users.bob.did)
    expect(bobFollow?.name).toEqual(users.bob.name)
    expect(bobFollow?.displayName).toEqual(users.bob.displayName)
    expect(bobFollow?.createdAt).toBeDefined()
    expect(bobFollow?.indexedAt).toBeDefined()
    const carolFollow = view.data.followers.find(
      (f) => f.name === users.carol.name,
    )
    expect(carolFollow?.did).toEqual(users.carol.did)
    expect(carolFollow?.name).toEqual(users.carol.name)
    expect(carolFollow?.displayName).toEqual(users.carol.displayName)
    expect(carolFollow?.createdAt).toBeDefined()
    expect(carolFollow?.indexedAt).toBeDefined()
  })

  it('fetches follows', async () => {
    const view = await client.todo.social.getUserFollows({
      user: 'bob',
    })
    expect(view.data.subject.did).toEqual(users.bob.did)
    expect(view.data.subject.name).toEqual(users.bob.name)
    expect(view.data.subject.displayName).toEqual(users.bob.displayName)
    const alice = view.data.follows.find((f) => f.name === users.alice.name)
    expect(alice?.did).toEqual(users.alice.did)
    expect(alice?.name).toEqual(users.alice.name)
    expect(alice?.displayName).toEqual(users.alice.displayName)
    expect(alice?.createdAt).toBeDefined()
    expect(alice?.indexedAt).toBeDefined()
    const carolFollow = view.data.follows.find(
      (f) => f.name === users.carol.name,
    )
    expect(carolFollow?.did).toEqual(users.carol.did)
    expect(carolFollow?.name).toEqual(users.carol.name)
    expect(carolFollow?.displayName).toEqual(users.carol.displayName)
    expect(carolFollow?.createdAt).toBeDefined()
    expect(carolFollow?.indexedAt).toBeDefined()
  })

  it('fetches profile', async () => {
    const aliceProf = await client.todo.social.getProfile(
      {
        user: 'alice',
      },
      undefined,
      {
        headers: {
          Authorization: users.bob.did,
        },
      },
    )
    expect(aliceProf.data.did).toEqual(users.alice.did)
    expect(aliceProf.data.name).toEqual(users.alice.name)
    expect(aliceProf.data.displayName).toEqual(users.alice.displayName)
    expect(aliceProf.data.description).toEqual(users.alice.description)
    expect(aliceProf.data.followersCount).toEqual(2)
    expect(aliceProf.data.followsCount).toEqual(3)
    expect(aliceProf.data.postsCount).toEqual(4)
    // TODO
    // expect(aliceProf.data.badges.length).toEqual(1)
    // expect(aliceProf.data.badges[0].uri).toEqual(badges[0].toString())
    // expect(aliceProf.data.badges[0].assertion?.type).toEqual('tag')
    // expect(aliceProf.data.badges[0].issuer?.did).toEqual(users.bob.did)
    // expect(aliceProf.data.badges[0].issuer?.name).toEqual(users.bob.name)
    // expect(aliceProf.data.badges[0].issuer?.displayName).toEqual(
    //   users.bob.displayName,
    // )
    expect(aliceProf.data.myState?.follow).toEqual(
      bobFollows[users.alice.did]?.toString(),
    )

    const danProf = await client.todo.social.getProfile(
      {
        user: 'dan',
      },
      undefined,
      {
        headers: {
          Authorization: users.bob.did,
        },
      },
    )
    expect(danProf.data.did).toEqual(users.dan.did)
    expect(danProf.data.name).toEqual(users.dan.name)
    expect(danProf.data.displayName).toEqual(users.dan.displayName)
    expect(danProf.data.description).toEqual(users.dan.description)
    expect(danProf.data.followersCount).toEqual(1)
    expect(danProf.data.followsCount).toEqual(1)
    expect(danProf.data.postsCount).toEqual(2)
    expect(danProf.data.badges).toEqual([])
    expect(danProf.data.myState?.follow).toEqual(
      bobFollows[users.dan.did]?.toString(),
    )
  })

  it('fetches timeline', async () => {
    const aliceFeed = await client.todo.social.getFeed({}, undefined, {
      headers: {
        Authorization: users.alice.did,
      },
    })
    expect(aliceFeed.data.feed.length).toBe(7)
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[0].record.text).toEqual(replies.carol[0])
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[1].record.text).toEqual(replies.bob[0])
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[2].record.text).toEqual(posts.bob[1])
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[3].record.text).toEqual(posts.dan[1])
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[4].record.text).toEqual(posts.dan[0])
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[5].record.text).toEqual(posts.carol[0])
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[6].record.text).toEqual(posts.bob[0])
    expect(aliceFeed.data.feed[3].repostCount).toEqual(1)

    const bobFeed = await client.todo.social.getFeed({}, undefined, {
      headers: {
        Authorization: users.bob.did,
      },
    })
    expect(bobFeed.data.feed.length).toBe(7)
    /** @ts-ignore TODO */
    expect(bobFeed.data.feed[0].record.text).toEqual(replies.alice[0])
    /** @ts-ignore TODO */
    expect(bobFeed.data.feed[1].record.text).toEqual(replies.carol[0])
    /** @ts-ignore TODO */
    expect(bobFeed.data.feed[2].record.text).toEqual(posts.alice[2])
    /** @ts-ignore TODO */
    expect(bobFeed.data.feed[3].record.text).toEqual(posts.alice[1])
    /** @ts-ignore TODO */
    expect(bobFeed.data.feed[4].record.text).toEqual(posts.dan[1])
    /** @ts-ignore TODO */
    expect(bobFeed.data.feed[5].record.text).toEqual(posts.carol[0])
    /** @ts-ignore TODO */
    expect(bobFeed.data.feed[6].record.text).toEqual(posts.alice[0])
    expect(bobFeed.data.feed[3].replyCount).toEqual(2)
    expect(bobFeed.data.feed[3].likeCount).toEqual(3)
    expect(bobFeed.data.feed[2].likeCount).toEqual(2)
    expect(bobFeed.data.feed[3]?.myState?.like).toEqual(
      bobLikes[alicePosts[1].toString()],
    )
    expect(bobFeed.data.feed[6]?.myState?.like).toBeUndefined()
  })

  it('fetches user feed', async () => {
    const aliceFeed = await client.todo.social.getFeed(
      { author: 'alice' },
      undefined,
      {
        headers: {
          Authorization: users.bob.did,
        },
      },
    )
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[0].record.text).toEqual(replies.alice[0])
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[1].record.text).toEqual(posts.alice[2])
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[2].record.text).toEqual(posts.alice[1])
    /** @ts-ignore TODO */
    expect(aliceFeed.data.feed[3].record.text).toEqual(posts.alice[0])

    const carolFeed = await client.todo.social.getFeed(
      { author: 'carol' },
      undefined,
      {
        headers: {
          Authorization: users.bob.did,
        },
      },
    )
    /** @ts-ignore TODO */
    expect(carolFeed.data.feed[0].record.text).toEqual(replies.carol[0])
    /** @ts-ignore TODO */
    expect(carolFeed.data.feed[1].record.text).toEqual(posts.dan[1])
    /** @ts-ignore TODO */
    expect(carolFeed.data.feed[2].record.text).toEqual(posts.carol[0])
  })

  it('fetches postThread', async () => {
    const thread = await client.todo.social.getPostThread(
      { uri: alicePosts[1].toString() },
      undefined,
      {
        headers: {
          Authorization: users.bob.did,
        },
      },
    )
    /** @ts-ignore TODO */
    expect(thread.data.thread.record.text).toEqual(posts.alice[1])
    expect(thread.data.thread.replyCount).toEqual(2)
    expect(thread.data.thread.likeCount).toEqual(3)
    expect(thread.data.thread.replies?.length).toEqual(2)
    /** @ts-ignore TODO */
    expect(thread.data.thread.replies?.[0].record.text).toEqual(
      replies.carol[0],
    )
    /** @ts-ignore TODO */
    expect(thread.data.thread.replies?.[1].record.text).toEqual(replies.bob[0])
    /** @ts-ignore TODO */
    expect(thread.data.thread.replies?.[1].parent?.record.text).toEqual(
      posts.alice[1],
    )
    /** @ts-ignore TODO */
    // TODO: this is failing -- not clear to me why
    expect(thread.data.thread.replies?.[1].replies?.[0].record.text).toEqual(
      replies.alice[0],
    )
  })
})
