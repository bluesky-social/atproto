import test from 'ava'
import axios from 'axios'
import * as ucan from 'ucans'

import { IpldStore, TID, MicroblogDelegator } from '@bluesky-demo/common'
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

let postTid: TID
const postText = 'hello world!'

test.serial('create post', async (t) => {
  postTid = await aliceBlog.addPost(postText)
  t.pass('create post successful')
})

test.serial('get post', async (t) => {
  const post = await aliceBlog.getPost(postTid)
  t.is(post?.text, postText, 'post matches')
})

test.serial('edit post', async (t) => {
  const newText = 'howdy universe!'
  await aliceBlog.editPost(postTid, newText)
  t.pass('edit post successful')
  const post = await aliceBlog.getPost(postTid)
  t.is(post?.text, newText, 'edited post matches')
})

test.serial('create like', async (t) => {
  const post = await bobBlog.getPostFromUser(aliceBlog.did, postTid)
  if (post !== null) {
    await bobBlog.likePost(post)
  }
  t.pass('create like successful')
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
  console.log('FOLLOWS: ', follows)
  t.pass('successfully followed user')
})

// test.serial('unfollow user', async (t) => {
//   await aliceBlog.deletePost(postTid)
//   const post = await aliceBlog.getPost(postTid)
//   t.is(post, null, 'post successfully deleted')
// })
