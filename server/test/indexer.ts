import test from 'ava'

import {
  TID,
  MicroblogDelegator,
  Post,
  TimelinePost,
} from '@bluesky-demo/common'
import { newClient, runTestServer } from './_util.js'

const USE_TEST_SERVER = true

const PORT = USE_TEST_SERVER ? 2584 : 2583
const SERVER_URL = `http://localhost:${PORT}`

let alice: MicroblogDelegator
let bob: MicroblogDelegator
let carol: MicroblogDelegator
let dan: MicroblogDelegator

test.before('run server', async () => {
  if (USE_TEST_SERVER) {
    await runTestServer(PORT)
  }
  alice = await newClient(SERVER_URL)
  bob = await newClient(SERVER_URL)
  carol = await newClient(SERVER_URL)
  dan = await newClient(SERVER_URL)
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
