import test from 'ava'
import axios from 'axios'
import * as ucan from 'ucans'

import {
  UserStore,
  IpldStore,
  Microblog,
  TID,
  Post,
} from '@bluesky-demo/common'
import database from '../src/db/memory.js'
import * as tables from '../src/db/tables.js'
import server from '../src/server.js'
import { CreatePostReq, GetPostReq } from '../src/routes/data/post.js'

const USE_TEST_SERVER = false

const PORT = 2583
const SERVER_URL = `http://localhost:${PORT}`

const aliceName = 'alice'
let aliceKey: ucan.EdKeypair
let aliceDid: string
let aliceStore: UserStore
let aliceBlog: Microblog

const blockstore = IpldStore.createInMemory()

test.before('run server', async () => {
  if (USE_TEST_SERVER) {
    const db = database()
    const serverBlockstore = IpldStore.createInMemory()
    await tables.dropAll(db)
    await tables.create(db)
    server(serverBlockstore, db, PORT)
  }
  aliceKey = await ucan.EdKeypair.create()
  aliceDid = aliceKey.did()
  aliceStore = await UserStore.create(blockstore, aliceDid, aliceKey)
  aliceBlog = new Microblog(aliceStore)
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
let post: Post

test.serial('upload post', async (t) => {
  postTid = TID.next()
  post = {
    tid: postTid.toString(),
    author: aliceDid,
    program: aliceBlog.name,
    text: 'hello world!',
    time: new Date().toISOString(),
  }
  const data: CreatePostReq = {
    did: aliceDid,
    program: aliceBlog.name,
    post,
  }
  const res = await axios.post(`${SERVER_URL}/data/post`, data)
  t.is(res.status, 200, 'create post successful')
})

test.serial('get post', async (t) => {
  const data: GetPostReq = {
    did: aliceDid,
    program: aliceBlog.name,
    tid: postTid.toString(),
  }
  const res = await axios.get(`${SERVER_URL}/data/post`, { params: data })
  t.is(res.status, 200, 'get post successful')
  t.deepEqual(res.data, post, 'post matches')
})

// test.serial('create & upload a user store', async (t) => {
//   await aliceBlog.addPost('hello world!')
//   const car = await aliceStore.getFullHistory()
//   await axios.post(`${SERVER_URL}/user/${aliceDid}`, car, {
//     headers: {
//       'Content-Type': 'application/octet-stream',
//     },
//   })
//   t.true(true, 'successfully uploaded')
// })

// test.serial('upload diff of user store', async (t) => {
//   const beforeCid = aliceStore.cid
//   await aliceBlog.addPost('howdy planet!')
//   const car = await aliceStore.getDiffCar(beforeCid)
//   await axios.post(`${SERVER_URL}/user/${aliceDid}`, car, {
//     headers: {
//       'Content-Type': 'application/octet-stream',
//     },
//   })
//   t.true(true, 'successfully uploaded diff')
// })

// test.serial('loads user store', async (t) => {
//   const res = await axios.get(`${SERVER_URL}/user/${aliceDid}`, {
//     responseType: 'arraybuffer',
//   })
//   const car = new Uint8Array(res.data)
//   const reloaded = await UserStore.fromCarFile(car, blockstore)
//   const blogView = new Microblog(reloaded)
//   const posts = await blogView.listPosts(10)
//   t.is(posts[0].text, 'howdy planet!')
//   t.is(posts[1].text, 'hello world!')
// })
