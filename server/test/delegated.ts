import test from 'ava'

import { TID, MicroblogDelegator, Post, Like } from '@bluesky-demo/common'

import { newClient, runTestServer } from './_util.js'

const USE_TEST_SERVER = true

const PORT = 2583
const SERVER_URL = `http://localhost:${PORT}`

let alice: MicroblogDelegator
let bob: MicroblogDelegator

test.before('run server', async () => {
  if (USE_TEST_SERVER) {
    await runTestServer(PORT)
  }
  alice = await newClient(SERVER_URL)
  bob = await newClient(SERVER_URL)
})

test.serial('id registration', async (t) => {
  await alice.register('alice')
  await bob.register('bob')
  t.pass('registration success')
})

test.serial('id retrieval', async (t) => {
  const did = await alice.lookupDid('alice')
  t.is(did, alice.did, 'did retrieval success')
})

let post: Post
let postTid: TID
const postText = 'hello world!'

test.serial('create post', async (t) => {
  post = await alice.addPost(postText)
  postTid = TID.fromStr(post.tid)
  t.pass('create post successful')
})

test.serial('get post', async (t) => {
  const got = await alice.getPost(postTid)
  t.is(got?.text, postText, 'post matches')
})

test.serial('edit post', async (t) => {
  const newText = 'howdy universe!'
  await alice.editPost(postTid, newText)
  t.pass('edit post successful')
  const post = await alice.getPost(postTid)
  t.is(post?.text, newText, 'edited post matches')
})

let like: Like
let likeTid: TID

test.serial('create like', async (t) => {
  like = await bob.likePost(alice.did, postTid)
  likeTid = TID.fromStr(like.tid)
  t.pass('create like successful')
})

test.serial('list likes', async (t) => {
  const likes = await bob.listLikes(10)
  t.is(likes.length, 1, 'registered like')
  t.is(likes[0].tid, likeTid.toString(), 'matching tid')
  t.is(likes[0].post_tid, postTid.toString(), 'matching post tid')
})

test.serial('delete like', async (t) => {
  await bob.deleteLike(likeTid)
  t.pass('delete request successful')
  const likes = await bob.listLikes(10)
  t.is(likes.length, 0, 'properly deleted like')
})

test.serial('delete post', async (t) => {
  await alice.deletePost(postTid)
  const post = await alice.getPost(postTid)
  t.is(post, null, 'post successfully deleted')
})

test.serial('follow user', async (t) => {
  // register bob
  await alice.followUser(bob.did)
  t.pass('successfully followed user')
})

test.serial('list follows', async (t) => {
  const follows = await alice.listFollows()
  t.is(follows.length, 1, 'registered follow')
  t.is(follows[0].did, bob.did, 'matching did')
  t.is(follows[0].username, 'bob', 'matching username')

  t.pass('successfully followed user')
})

test.serial('unfollow user', async (t) => {
  await alice.unfollowUser(bob.did)
  t.pass('unfollow request successful')
  const follows = await alice.listFollows()
  t.is(follows.length, 0, 'properly unfollowed user')
})
