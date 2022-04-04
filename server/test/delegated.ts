import test from 'ava'

import * as ucan from 'ucans'

import {
  IpldStore,
  TID,
  MicroblogDelegator,
  Post,
  Like,
} from '@bluesky-demo/common'
import Database from '../src/db/index.js'
import server from '../src/server.js'

const USE_TEST_SERVER = false

const PORT = 2583
const SERVER_URL = `http://localhost:${PORT}`

let aliceKey: ucan.EdKeypair
let aliceBlog: MicroblogDelegator
let bobKey: ucan.EdKeypair
let bobBlog: MicroblogDelegator

test.before('run server', async () => {
  if (USE_TEST_SERVER) {
    const db = Database.memory()
    const serverBlockstore = IpldStore.createInMemory()
    await db.dropTables()
    await db.createTables()
    server(serverBlockstore, db, PORT)
  }
  aliceKey = await ucan.EdKeypair.create()
  aliceBlog = new MicroblogDelegator(SERVER_URL, aliceKey)

  bobKey = await ucan.EdKeypair.create()
  bobBlog = new MicroblogDelegator(SERVER_URL, bobKey)
})

test.serial('id registration', async (t) => {
  await aliceBlog.register('alice')
  await bobBlog.register('bob')
  t.pass('registration success')
})

test.serial('id retrieval', async (t) => {
  const did = await aliceBlog.lookupDid('alice')
  t.is(did, aliceBlog.did, 'did retrieval success')
})

let post: Post
let postTid: TID
const postText = 'hello world!'

test.serial('create post', async (t) => {
  post = await aliceBlog.addPost(postText)
  postTid = TID.fromStr(post.tid)
  t.pass('create post successful')
})

test.serial('get post', async (t) => {
  const got = await aliceBlog.getPost(postTid)
  t.is(got?.text, postText, 'post matches')
})

test.serial('edit post', async (t) => {
  const newText = 'howdy universe!'
  await aliceBlog.editPost(postTid, newText)
  t.pass('edit post successful')
  const post = await aliceBlog.getPost(postTid)
  t.is(post?.text, newText, 'edited post matches')
})

let like: Like
let likeTid: TID

test.serial('create like', async (t) => {
  like = await bobBlog.likePost(aliceBlog.did, postTid)
  likeTid = TID.fromStr(like.tid)
  t.pass('create like successful')
})

test.serial('list likes', async (t) => {
  const likes = await bobBlog.listLikes(10)
  t.is(likes.length, 1, 'registered like')
  t.is(likes[0].tid, likeTid.toString(), 'matching tid')
  t.is(likes[0].post_tid, postTid.toString(), 'matching post tid')
})

test.serial('delete like', async (t) => {
  await bobBlog.deleteLike(likeTid)
  t.pass('delete request successful')
  const likes = await bobBlog.listLikes(10)
  t.is(likes.length, 0, 'properly deleted like')
})

test.serial('delete post', async (t) => {
  await aliceBlog.deletePost(postTid)
  const post = await aliceBlog.getPost(postTid)
  t.is(post, null, 'post successfully deleted')
})

test.serial('follow user', async (t) => {
  // register bob
  await aliceBlog.followUser(bobKey.did())
  t.pass('successfully followed user')
})

test.serial('list follows', async (t) => {
  const follows = await aliceBlog.listFollows()
  t.is(follows.length, 1, 'registered follow')
  t.is(follows[0].did, bobKey.did(), 'matching did')
  t.is(follows[0].username, 'bob', 'matching username')

  t.pass('successfully followed user')
})

test.serial('unfollow user', async (t) => {
  await aliceBlog.unfollowUser(bobKey.did())
  t.pass('unfollow request successful')
  const follows = await aliceBlog.listFollows()
  t.is(follows.length, 0, 'properly unfollowed user')
})
