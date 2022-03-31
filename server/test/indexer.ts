import test from 'ava'

import * as ucan from 'ucans'

import {
  IpldStore,
  TID,
  MicroblogDelegator,
  Post,
  TimelinePost,
} from '@bluesky-demo/common'
import Database from '../src/db/index.js'
import server from '../src/server.js'

const USE_TEST_SERVER = false

const PORT = 2583
const SERVER_URL = `http://localhost:${PORT}`

let alice: MicroblogDelegator
let bob: MicroblogDelegator
let carol: MicroblogDelegator
let dan: MicroblogDelegator

test.before('run server', async () => {
  if (USE_TEST_SERVER) {
    const db = Database.memory()
    const serverBlockstore = IpldStore.createInMemory()
    await db.dropTables()
    await db.createTables()
    server(serverBlockstore, db, PORT)
  }
  alice = new MicroblogDelegator(SERVER_URL, await ucan.EdKeypair.create())
  bob = new MicroblogDelegator(SERVER_URL, await ucan.EdKeypair.create())
  carol = new MicroblogDelegator(SERVER_URL, await ucan.EdKeypair.create())
  dan = new MicroblogDelegator(SERVER_URL, await ucan.EdKeypair.create())
  await alice.register('alice')
  await bob.register('bob')
  await carol.register('carol')
  await dan.register('dan')
})

test.serial('follow multiple users', async (t) => {
  await alice.followUser(bob.did)
  await alice.followUser(carol.did)
  await alice.followUser(dan.did)
  t.pass('followed users')
})

let timelineTids: TID[]

test.serial('populate the timeline', async (t) => {
  await bob.addPost('one')
  await bob.addPost('two')
  await carol.addPost('three')
  await dan.addPost('four')
  await carol.addPost('five')
  await bob.addPost('six')
  await dan.addPost('seven')
  await dan.addPost('eight')
  await carol.addPost('nine')
  await bob.addPost('ten')

  t.pass('populated timeline')
})

test.serial('get timeline', async (t) => {
  const timeline = await alice.retrieveTimeline(10)
  const timelineText = timeline.map((p: TimelinePost) => p.text)
  const expected = [
    'ten',
    'nine',
    'eight',
    'seven',
    'six',
    'five',
    'four',
    'three',
    'two',
    'one',
  ]
  t.deepEqual(timelineText, expected, 'correct timeline')
})

test.serial('get old timeline', async (t) => {
  const timeline = await alice.retrieveTimeline(2)
  const lastSeen = TID.fromStr(timeline[1].tid)
  const oldTimeline = await alice.retrieveTimeline(10, lastSeen)
  const timelineText = oldTimeline.map((p: TimelinePost) => p.text)
  const expected = [
    'eight',
    'seven',
    'six',
    'five',
    'four',
    'three',
    'two',
    'one',
  ]
  t.deepEqual(timelineText, expected, 'correct timeline')
})

let post: Post

test.serial('get some likes on your post', async (t) => {
  post = await alice.addPost('hello world!')
  const tid = TID.fromStr(post.tid)
  await bob.likePost(alice.did, tid)
  await carol.likePost(alice.did, tid)
  await dan.likePost(alice.did, tid)
  t.pass('got some likes')
})

test.serial('count likes on post', async (t) => {
  const count = await alice.likeCount(alice.did, TID.fromStr(post.tid))
  t.is(count, 3, 'counted likes')
})
