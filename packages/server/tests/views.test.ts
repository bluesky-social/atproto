import { AdxUri } from '@adxp/common'
import { MicroblogClient, Post } from '@adxp/microblog'
import { users, posts, replies } from './test-data'
import util from 'util'

const url = 'http://localhost:2583'
const alice = new MicroblogClient(url, users.alice.did)
const bob = new MicroblogClient(url, users.bob.did)
const carol = new MicroblogClient(url, users.carol.did)
const dan = new MicroblogClient(url, users.dan.did)

let alicePosts: AdxUri[] = []
let bobPosts: AdxUri[] = []
let carolPosts: AdxUri[] = []
let danPosts: AdxUri[] = []
let bobFollows: Record<string, AdxUri> = {}
let bobLikes: Record<string, AdxUri> = {}
let badges: AdxUri[] = []

describe('server', () => {
  it('register users', async () => {
    await alice.register(users.alice.name)
    await bob.register(users.bob.name)
    await carol.register(users.carol.name)
    await dan.register(users.dan.name)
  })

  it('creates profiles', async () => {
    await alice.createProfile(users.alice.displayName, users.alice.description)
    await bob.createProfile(users.bob.displayName, users.bob.description)
  })

  it('follow people', async () => {
    await alice.followUser(bob.did)
    await alice.followUser(carol.did)
    await alice.followUser(dan.did)
    bobFollows[alice.did] = await bob.followUser(alice.did)
    bobFollows[carol.did] = await bob.followUser(carol.did)
    await carol.followUser(alice.did)
    await dan.followUser(bob.did)
  })

  it('makes some posts', async () => {
    const alice0 = await alice.createPost(posts.alice[0])
    const bob0 = await bob.createPost(posts.bob[0])
    const carol0 = await carol.createPost(posts.carol[0])
    const dan0 = await dan.createPost(posts.dan[0])
    const dan1 = await dan.createPost(posts.dan[1], [
      {
        index: [0, 18],
        type: 'mention',
        value: users.carol.did,
      } as any, //@TODO remove any
    ])
    const alice1 = await alice.createPost(posts.alice[1])
    const bob1 = await bob.createPost(posts.bob[1])
    const alice2 = await alice.createPost(posts.alice[2])
    alicePosts = [alice0, alice1, alice2]
    bobPosts = [bob0, bob1]
    carolPosts = [carol0]
    danPosts = [dan0, dan1]
  })

  it('likes a post', async () => {
    bobLikes[alicePosts[2].toString()] = await bob.likePost(alicePosts[1])
    bobLikes[alicePosts[2].toString()] = await bob.likePost(alicePosts[2])
    await carol.likePost(alicePosts[1])
    await carol.likePost(alicePosts[2])
    await dan.likePost(alicePosts[1])
  })

  it('replies to a post', async () => {
    const bobReply = await bob.reply(
      alicePosts[1],
      alicePosts[1],
      replies.bob[0],
    )
    await carol.reply(alicePosts[1], alicePosts[1], replies.carol[0])
    await alice.reply(alicePosts[1], bobReply, replies.alice[0])
  })

  it('reposts a post', async () => {
    await carol.repost(danPosts[1])
  })

  it('gives badges', async () => {
    const badge0 = await bob.giveBadge(users.alice.did, 'tag', 'tech')
    const badge1 = await bob.giveBadge(users.alice.did, 'invite')
    badges = [badge0, badge1]
  })

  it('accepts badges', async () => {
    await alice.acceptBadge(badges[0])
  })

  it('fetches liked by view', async () => {
    const view = await alice.likedByView(alicePosts[1])
    expect(view.uri).toEqual(alicePosts[1].toString())
    expect(view.likedBy.length).toBe(3)
    const bobLike = view.likedBy.find((l) => l.name === users.bob.name)
    expect(bobLike?.did).toEqual(users.bob.did)
    expect(bobLike?.displayName).toEqual(users.bob.displayName)
    expect(bobLike?.createdAt).toBeDefined()
    expect(bobLike?.indexedAt).toBeDefined()
    const carolLike = view.likedBy.find((l) => l.name === users.carol.name)
    expect(carolLike?.did).toEqual(users.carol.did)
    expect(carolLike?.displayName).toEqual(users.carol.displayName)
    expect(carolLike?.createdAt).toBeDefined()
    expect(carolLike?.indexedAt).toBeDefined()
    const danLike = view.likedBy.find((l) => l.name === users.dan.name)
    expect(danLike?.did).toEqual(users.dan.did)
    expect(danLike?.displayName).toEqual(users.dan.displayName)
    expect(danLike?.createdAt).toBeDefined()
    expect(danLike?.indexedAt).toBeDefined()
  })

  it('fetches reposted by view', async () => {
    const view = await alice.repostedByView(danPosts[1])
    expect(view.uri).toEqual(danPosts[1].toString())
    expect(view.repostedBy.length).toBe(1)
    const repost = view.repostedBy[0]
    expect(repost.did).toEqual(users.carol.did)
    expect(repost.displayName).toEqual(users.carol.displayName)
    expect(repost.createdAt).toBeDefined()
    expect(repost.indexedAt).toBeDefined()
  })

  it('fetches followers', async () => {
    const view = await bob.userFollowersView('alice')
    expect(view.subject.did).toEqual(users.alice.did)
    expect(view.subject.name).toEqual(users.alice.name)
    expect(view.subject.displayName).toEqual(users.alice.displayName)
    const bobFollow = view.followers.find((f) => f.name === users.bob.name)
    expect(bobFollow?.did).toEqual(users.bob.did)
    expect(bobFollow?.name).toEqual(users.bob.name)
    expect(bobFollow?.displayName).toEqual(users.bob.displayName)
    expect(bobFollow?.createdAt).toBeDefined()
    expect(bobFollow?.indexedAt).toBeDefined()
    const carolFollow = view.followers.find((f) => f.name === users.carol.name)
    expect(carolFollow?.did).toEqual(users.carol.did)
    expect(carolFollow?.name).toEqual(users.carol.name)
    expect(carolFollow?.displayName).toEqual(users.carol.displayName)
    expect(carolFollow?.createdAt).toBeDefined()
    expect(carolFollow?.indexedAt).toBeDefined()
  })

  it('fetches follows', async () => {
    const view = await bob.userFollowsView('bob')
    expect(view.subject.did).toEqual(users.bob.did)
    expect(view.subject.name).toEqual(users.bob.name)
    expect(view.subject.displayName).toEqual(users.bob.displayName)
    const alice = view.follows.find((f) => f.name === users.alice.name)
    expect(alice?.did).toEqual(users.alice.did)
    expect(alice?.name).toEqual(users.alice.name)
    expect(alice?.displayName).toEqual(users.alice.displayName)
    expect(alice?.createdAt).toBeDefined()
    expect(alice?.indexedAt).toBeDefined()
    const carolFollow = view.follows.find((f) => f.name === users.carol.name)
    expect(carolFollow?.did).toEqual(users.carol.did)
    expect(carolFollow?.name).toEqual(users.carol.name)
    expect(carolFollow?.displayName).toEqual(users.carol.displayName)
    expect(carolFollow?.createdAt).toBeDefined()
    expect(carolFollow?.indexedAt).toBeDefined()
  })

  it('fetches profile', async () => {
    const aliceProf = await bob.profileView('alice')
    expect(aliceProf.did).toEqual(users.alice.did)
    expect(aliceProf.name).toEqual(users.alice.name)
    expect(aliceProf.displayName).toEqual(users.alice.displayName)
    expect(aliceProf.description).toEqual(users.alice.description)
    expect(aliceProf.followersCount).toEqual(2)
    expect(aliceProf.followsCount).toEqual(3)
    expect(aliceProf.postsCount).toEqual(4)
    expect(aliceProf.badges.length).toEqual(1)
    expect(aliceProf.badges[0].uri).toEqual(badges[0].toString())
    expect(aliceProf.badges[0].assertion?.type).toEqual('tag')
    expect(aliceProf.badges[0].issuer?.did).toEqual(users.bob.did)
    expect(aliceProf.badges[0].issuer?.name).toEqual(users.bob.name)
    expect(aliceProf.badges[0].issuer?.displayName).toEqual(
      users.bob.displayName,
    )
    expect(aliceProf.myState?.follow).toEqual(bobFollows[alice.did]?.toString())

    const danProf = await bob.profileView('dan')
    expect(danProf.did).toEqual(users.dan.did)
    expect(danProf.name).toEqual(users.dan.name)
    expect(danProf.displayName).toEqual(users.dan.displayName)
    expect(danProf.description).toEqual(users.dan.description)
    expect(danProf.followersCount).toEqual(1)
    expect(danProf.followsCount).toEqual(1)
    expect(danProf.postsCount).toEqual(2)
    expect(danProf.badges).toEqual([])
    expect(danProf.myState?.follow).toEqual(bobFollows[dan.did]?.toString())
  })

  it('fetches timeline', async () => {
    const aliceFeed: any = await alice.feedView()
    expect(aliceFeed.length).toBe(7)
    expect(aliceFeed[0].record.text).toEqual(replies.carol[0])
    expect(aliceFeed[1].record.text).toEqual(replies.bob[0])
    expect(aliceFeed[2].record.text).toEqual(posts.bob[1])
    expect(aliceFeed[3].record.text).toEqual(posts.dan[1])
    expect(aliceFeed[4].record.text).toEqual(posts.dan[0])
    expect(aliceFeed[5].record.text).toEqual(posts.carol[0])
    expect(aliceFeed[6].record.text).toEqual(posts.bob[0])
    expect(aliceFeed[3].repostCount).toEqual(1)

    const bobFeed: any = await bob.feedView()
    expect(bobFeed.length).toBe(7)
    expect(bobFeed[0].record.text).toEqual(replies.alice[0])
    expect(bobFeed[1].record.text).toEqual(replies.carol[0])
    expect(bobFeed[2].record.text).toEqual(posts.alice[2])
    expect(bobFeed[3].record.text).toEqual(posts.alice[1])
    expect(bobFeed[4].record.text).toEqual(posts.dan[1])
    expect(bobFeed[5].record.text).toEqual(posts.carol[0])
    expect(bobFeed[6].record.text).toEqual(posts.alice[0])
    expect(bobFeed[3].replyCount).toEqual(2)
    expect(bobFeed[3].likeCount).toEqual(3)
    expect(bobFeed[2].likeCount).toEqual(2)
    expect(bobFeed[3]?.myState?.like).toEqual(
      bobLikes[alicePosts[1].toString()],
    )
    expect(bobFeed[6]?.myState?.like).toBeUndefined()
  })

  it('fetches user feed', async () => {
    const aliceFeed: any = await bob.userFeedView('alice')
    expect(aliceFeed[0].record.text).toEqual(replies.alice[0])
    expect(aliceFeed[1].record.text).toEqual(posts.alice[2])
    expect(aliceFeed[2].record.text).toEqual(posts.alice[1])
    expect(aliceFeed[3].record.text).toEqual(posts.alice[0])

    const carolFeed: any = await bob.userFeedView('carol')
    expect(carolFeed[0].record.text).toEqual(replies.carol[0])
    expect(carolFeed[1].record.text).toEqual(posts.dan[1])
    expect(carolFeed[2].record.text).toEqual(posts.carol[0])
  })

  it('fetches postThread', async () => {
    const thread: any = await bob.postThreadView(alicePosts[1], 2)
    expect(thread.record.text).toEqual(posts.alice[1])
    expect(thread.replyCount).toEqual(2)
    expect(thread.likeCount).toEqual(3)
    expect(thread.replies.length).toEqual(2)
    expect(thread.replies[0].record.text).toEqual(replies.carol[0])
    expect(thread.replies[1].record.text).toEqual(replies.bob[0])
    expect(thread.replies[1].parent.record.text).toEqual(posts.alice[1])
    expect(thread.replies[1].replies[0].record.text).toEqual(replies.alice[0])
  })
})
