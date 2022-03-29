import test from 'ava'
import axios from 'axios'
import * as ucan from 'ucans'

import {
  Repo,
  IpldStore,
  Microblog,
  TID,
  Post,
  MicroblogDelegator,
} from '@bluesky-demo/common'
import Database from '../src/db/index.js'
import server from '../src/server.js'
import { GetPostReq } from '../src/routes/data/post.js'

const USE_TEST_SERVER = false

const PORT = 2583
const SERVER_URL = `http://localhost:${PORT}`

const aliceName = 'alice'
let aliceKey: ucan.EdKeypair
let aliceDid: string
let aliceBlog: MicroblogDelegator
// let aliceRepo: Repo
// let aliceBlog: Microblog

const blockstore = IpldStore.createInMemory()

test.before('run server', async () => {
  if (USE_TEST_SERVER) {
    const db = Database.memory()
    const serverBlockstore = IpldStore.createInMemory()
    await db.dropTables()
    await db.createTables()
    server(serverBlockstore, db, PORT)
  }
  aliceKey = await ucan.EdKeypair.create()
  aliceDid = aliceKey.did()
  aliceBlog = new MicroblogDelegator(SERVER_URL, aliceDid)
  // aliceRepo = await Repo.create(blockstore, aliceDid, aliceKey)
  // aliceBlog = new Microblog(aliceRepo)
})

test.serial('id registration', async (t) => {
  const res = await axios.post(`${SERVER_URL}/id/register`, {
    username: aliceName,
    did: aliceDid,
  })
  t.is(res.status, 200, 'registration success')
})

test.serial('id retrieval', async (t) => {
  const res = await axios.get(
    `${SERVER_URL}/.well-known/webfinger?resource=${aliceName}`,
  )
  const didDoc = res.data
  t.is(didDoc.id, aliceDid, 'did retrieval success')
})

let postTid: TID
const postText = 'hello world!'

test.serial('upload post', async (t) => {
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

test.serial('delete post', async (t) => {
  await aliceBlog.deletePost(postTid)
  const post = await aliceBlog.getPost(postTid)
  t.is(post, null, 'post successfully deleted')
})
