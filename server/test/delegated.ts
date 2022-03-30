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
})

test.serial('id registration', async (t) => {
  const res = await axios.post(`${SERVER_URL}/id/register`, {
    username: 'alice',
    did: aliceBlog.did,
  })
  t.is(res.status, 200, 'registration success')
})

test.serial('id retrieval', async (t) => {
  const res = await axios.get(
    `${SERVER_URL}/.well-known/webfinger?resource=alice`,
  )
  const didDoc = res.data
  t.is(didDoc.id, aliceBlog.did, 'did retrieval success')
})

let postTid: TID
const postText = 'hello world!'

// test.serial('upload post', async (t) => {
//   postTid = await aliceBlog.addPost(postText)
//   t.pass('create post successful')
// })

// test.serial('get post', async (t) => {
//   const post = await aliceBlog.getPost(postTid)
//   t.is(post?.text, postText, 'post matches')
// })

// test.serial('edit post', async (t) => {
//   const newText = 'howdy universe!'
//   await aliceBlog.editPost(postTid, newText)
//   t.pass('edit post successful')
//   const post = await aliceBlog.getPost(postTid)
//   t.is(post?.text, newText, 'edited post matches')
// })

// test.serial('delete post', async (t) => {
//   await aliceBlog.deletePost(postTid)
//   const post = await aliceBlog.getPost(postTid)
//   t.is(post, null, 'post successfully deleted')
// })

test.serial('follow user', async (t) => {
  // register bob
  const bobKey = await ucan.EdKeypair.create()
  await axios.post(`${SERVER_URL}/id/register`, {
    username: 'bob',
    did: bobKey.did(),
  })

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
