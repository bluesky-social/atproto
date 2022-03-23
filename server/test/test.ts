import test from 'ava'
import axios from 'axios'
import * as ucan from 'ucans'

import { UserStore, IpldStore, Microblog } from '@bluesky-demo/common'
import database from '../src/db/persistent.js'
import * as tables from '../src/db/tables.js'
import server from '../src/server.js'

const db = database('./test.sqlite')
const serverBlockstore = IpldStore.createPersistent()
const PORT = 1337
const SERVER_URL = `http://localhost:${PORT}`

const aliceName = 'alice'
let aliceKey: ucan.EdKeypair
let aliceDid: string
let aliceStore: UserStore
let aliceBlog: Microblog

const blockstore = IpldStore.createInMemory()

test.before('run server', async () => {
  await tables.dropAll(db)
  await tables.create(db)
  aliceKey = await ucan.EdKeypair.create()
  aliceDid = aliceKey.did()
  aliceStore = await UserStore.create(blockstore, aliceKey)
  aliceBlog = new Microblog(aliceStore)
  server(serverBlockstore, db, PORT)
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

test.serial('create & upload a user store', async (t) => {
  await aliceBlog.addPost('hello world!')
  const car = await aliceStore.getFullHistory()
  await axios.post(`${SERVER_URL}/user/${aliceDid}`, car, {
    headers: {
      'Content-Type': 'application/octet-stream',
    },
  })
  t.true(true, 'successfully uploaded')
})

test.serial('upload diff of user store', async (t) => {
  const beforeCid = aliceStore.cid
  await aliceBlog.addPost('howdy planet!')
  const car = await aliceStore.getDiffCar(beforeCid)
  await axios.post(`${SERVER_URL}/user/${aliceDid}`, car, {
    headers: {
      'Content-Type': 'application/octet-stream',
    },
  })
  t.true(true, 'successfully uploaded diff')
})

test.serial('loads user store', async (t) => {
  const res = await axios.get(`${SERVER_URL}/user/${aliceDid}`, {
    responseType: 'arraybuffer',
  })
  const car = new Uint8Array(res.data)
  const reloaded = await UserStore.fromCarFile(car, blockstore)
  const blogView = new Microblog(reloaded)
  const posts = await blogView.listPosts(10)
  t.is(posts[0].text, 'howdy planet!')
  t.is(posts[1].text, 'hello world!')
})
