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
import Database from '../src/db/index.js'
import server from '../src/server.js'
import { GetPostReq } from '../src/routes/data/post.js'

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
    const db = Database.memory()
    const serverBlockstore = IpldStore.createInMemory()
    await db.dropTables()
    await db.createTables()
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
  const res = await axios.post(`${SERVER_URL}/data/post`, post)
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
