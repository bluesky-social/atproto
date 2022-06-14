import test from 'ava'

import { MicroblogDelegator, Post, Like } from '@adxp/common'

import { newClient, runTestServer } from './_util.js'

const USE_TEST_SERVER = true

const PORT = 2583
const HOST = `localhost:${PORT}`
const SERVER_URL = `http://${HOST}`

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
  const did = await alice.lookupDid(`alice@${HOST}`)
  t.is(did, alice.did, 'did retrieval success')
})

let post: Post
const postText = 'hello world!'

test.serial('create post', async (t) => {
  post = await alice.addPost(postText)
  t.pass('create post successful')
})

test.serial('get post', async (t) => {
  const got = await alice.getPost(post.tid)
  t.is(got?.text, postText, 'post matches')
})

test.serial('edit post', async (t) => {
  const newText = 'howdy universe!'
  await alice.editPost(post.tid, newText)
  t.pass('edit post successful')
  const got = await alice.getPost(post.tid)
  t.is(got?.text, newText, 'edited post matches')
})

let like: Like

test.serial('create like', async (t) => {
  like = await bob.likePost(alice.did, post.tid)
  t.pass('create like successful')
})

test.serial('list likes', async (t) => {
  const likes = await bob.listLikes(10)
  t.is(likes.length, 1, 'registered like')
  t.is(likes[0].tid.toString(), like.tid.toString(), 'matching tid')
  t.is(likes[0].post_tid.toString(), post.tid.toString(), 'matching post tid')
})

test.serial('delete like', async (t) => {
  await bob.deleteLike(like.tid)
  t.pass('delete request successful')
  const likes = await bob.listLikes(10)
  t.is(likes.length, 0, 'properly deleted like')
})

test.serial('delete post', async (t) => {
  await alice.deletePost(post.tid)
  const got = await alice.getPost(post.tid)
  t.is(got, null, 'post successfully deleted')
})

test.serial('follow user', async (t) => {
  // register bob
  await alice.followUser(`bob@${HOST}`)
  t.pass('successfully followed user')
})

test.serial('list follows', async (t) => {
  const follows = await alice.listFollows()
  t.is(follows.length, 1, 'registered follow')
  t.is(follows[0].did, bob.did, 'matching did')
  t.is(follows[0].username, `bob@${HOST}`, 'matching username')

  t.pass('successfully followed user')
})

test.serial('unfollow user', async (t) => {
  await alice.unfollowUser(bob.did)
  t.pass('unfollow request successful')
  const follows = await alice.listFollows()
  t.is(follows.length, 0, 'properly unfollowed user')
})
