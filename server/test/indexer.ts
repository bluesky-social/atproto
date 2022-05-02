import test from 'ava'

import { MicroblogDelegator, Post, TimelinePost } from '@adx/common'
import { newClient, runTestServer } from './_util.js'

const USE_TEST_SERVER = true

const PORT_ONE = USE_TEST_SERVER ? 2585 : 2583
const HOST_ONE = `localhost:${PORT_ONE}`
const SERVER_ONE = `http://${HOST_ONE}`
const PORT_TWO = USE_TEST_SERVER ? 2586 : 2584
const HOST_TWO = `localhost:${PORT_TWO}`
const SERVER_TWO = `http://${HOST_TWO}`

process.env['DID_NETWORK_URL'] = `${SERVER_ONE}/did-network`

let alice: MicroblogDelegator
let bob: MicroblogDelegator
let carol: MicroblogDelegator
let dan: MicroblogDelegator

test.before('run server', async () => {
  if (USE_TEST_SERVER) {
    await runTestServer(PORT_ONE)
    await runTestServer(PORT_TWO)
  }
  alice = await newClient(SERVER_ONE)
  bob = await newClient(SERVER_ONE)
  carol = await newClient(SERVER_TWO)
  dan = await newClient(SERVER_TWO)
  await alice.register('alice')
  await bob.register('bob')
  await carol.register('carol')
  await dan.register('dan')
})

test.serial('follow multiple users', async (t) => {
  await alice.followUser(`bob@${HOST_ONE}`)
  await alice.followUser(`carol@${HOST_TWO}`)
  await alice.followUser(`dan@${HOST_TWO}`)
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
  const lastSeen = timeline[1].tid
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
  const tid = post.tid
  await bob.likePost(alice.did, tid)
  await carol.likePost(alice.did, tid)
  await dan.likePost(alice.did, tid)
  t.pass('got some likes')
})

test.serial('count likes on post', async (t) => {
  const count = await alice.likeCount(alice.did, post.tid)
  t.is(count, 3, 'counted likes')
})
