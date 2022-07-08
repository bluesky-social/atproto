import { MicroblogDelegator, Post, Like } from '@adxp/common'

import { CloseFn, newClient, runTestServer } from './_util'

const USE_TEST_SERVER = true

const PORT = 2583
const HOST = `localhost:${PORT}`
const SERVER_URL = `http://${HOST}`

describe('delegator client', () => {
  let alice: MicroblogDelegator
  let bob: MicroblogDelegator

  let closeFn: CloseFn | undefined

  beforeAll(async () => {
    if (USE_TEST_SERVER) {
      closeFn = await runTestServer(PORT)
    }
    alice = await newClient(SERVER_URL)
    bob = await newClient(SERVER_URL)
  })

  afterAll(() => {
    if (closeFn) {
      closeFn()
    }
  })
  it('works', () => {
    expect(true)
  })

  it('registers id', async () => {
    await alice.register('alice')
    await bob.register('bob')
  })

  it('retrieves id', async () => {
    const did = await alice.lookupDid(`alice@${HOST}`)
    expect(did).toBe(alice.did)
  })

  let post: Post
  const postText = 'hello world!'

  it('creates post', async () => {
    post = await alice.addPost(postText)
  })

  it('gets post', async () => {
    const got = await alice.getPost(post.tid)
    expect(got?.text).toBe(postText)
  })

  it('edits post', async () => {
    const newText = 'howdy universe!'
    await alice.editPost(post.tid, newText)

    const got = await alice.getPost(post.tid)
    expect(got?.text).toBe(newText)
  })

  let like: Like

  it('creates like', async () => {
    like = await bob.likePost(alice.did, post.tid)
  })

  it('lists likes', async () => {
    const likes = await bob.listLikes(10)
    expect(likes.length).toBe(1)
    expect(likes[0].tid.toString()).toBe(like.tid.toString())
    expect(likes[0].post_tid.toString()).toBe(post.tid.toString())
  })

  it('deletes like', async () => {
    await bob.deleteLike(like.tid)
    const likes = await bob.listLikes(10)
    expect(likes.length).toBe(0)
  })

  it('deletes post', async () => {
    await alice.deletePost(post.tid)
    const got = await alice.getPost(post.tid)
    expect(got).toBe(null)
  })

  it('follows user', async () => {
    // register bob
    await alice.followUser(`bob@${HOST}`)
  })

  it('lists follows', async () => {
    const follows = await alice.listFollows()
    expect(follows.length).toBe(1)
    expect(follows[0].did).toBe(bob.did)
    expect(follows[0].username).toBe(`bob@${HOST}`)
  })

  it('unfollows user', async () => {
    await alice.unfollowUser(bob.did)
    const follows = await alice.listFollows()
    expect(follows.length).toBe(0)
  })
})
