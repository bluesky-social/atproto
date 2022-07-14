import { MicroblogDelegator, Post, TimelinePost } from '@adxp/common'
import { CloseFn, newClient, runTestServer } from './_util'

const USE_TEST_SERVER = true

const PORT_ONE = USE_TEST_SERVER ? 2585 : 2583
const HOST_ONE = `localhost:${PORT_ONE}`
const SERVER_ONE = `http://${HOST_ONE}`
const PORT_TWO = USE_TEST_SERVER ? 2586 : 2584
const HOST_TWO = `localhost:${PORT_TWO}`
const SERVER_TWO = `http://${HOST_TWO}`

process.env['DID_NETWORK_URL'] = `${SERVER_ONE}/did-network`

describe('@TODO', () => {
  it('does not run tests', () => {
    expect(true)
  })
})

// describe('indexer', () => {
//   let alice: MicroblogDelegator
//   let bob: MicroblogDelegator
//   let carol: MicroblogDelegator
//   let dan: MicroblogDelegator

//   let closeFn1, closeFn2: CloseFn | undefined

//   beforeAll(async () => {
//     if (USE_TEST_SERVER) {
//       closeFn1 = await runTestServer(PORT_ONE)
//       closeFn2 = await runTestServer(PORT_TWO)
//     }
//     alice = await newClient(SERVER_ONE)
//     bob = await newClient(SERVER_ONE)
//     carol = await newClient(SERVER_TWO)
//     dan = await newClient(SERVER_TWO)
//     await alice.register('alice')
//     await bob.register('bob')
//     await carol.register('carol')
//     await dan.register('dan')
//   })

//   afterAll(async () => {
//     if (closeFn1) {
//       await closeFn1()
//     }
//     if (closeFn2) {
//       await closeFn2()
//     }
//   })

//   it('follow multiple users', async () => {
//     await alice.followUser(`bob@${HOST_ONE}`)
//     await alice.followUser(`carol@${HOST_TWO}`)
//     await alice.followUser(`dan@${HOST_TWO}`)
//   })

//   it('populate the timeline', async () => {
//     await bob.addPost('one')
//     await bob.addPost('two')
//     await carol.addPost('three')
//     await dan.addPost('four')
//     await carol.addPost('five')
//     await bob.addPost('six')
//     await dan.addPost('seven')
//     await dan.addPost('eight')
//     await carol.addPost('nine')
//     await bob.addPost('ten')
//   })

//   it('get timeline', async () => {
//     const timeline = await alice.retrieveTimeline(10)
//     const timelineText = timeline.map((p: TimelinePost) => p.text)
//     const expected = [
//       'ten',
//       'nine',
//       'eight',
//       'seven',
//       'six',
//       'five',
//       'four',
//       'three',
//       'two',
//       'one',
//     ]
//     expect(timelineText).toEqual(expected)
//   })

//   it('get old timeline', async () => {
//     const timeline = await alice.retrieveTimeline(2)
//     const lastSeen = timeline[1].tid
//     const oldTimeline = await alice.retrieveTimeline(10, lastSeen)
//     const timelineText = oldTimeline.map((p: TimelinePost) => p.text)
//     const expected = [
//       'eight',
//       'seven',
//       'six',
//       'five',
//       'four',
//       'three',
//       'two',
//       'one',
//     ]
//     expect(timelineText).toEqual(expected)
//   })

//   let post: Post

//   it('get some likes on your post', async () => {
//     post = await alice.addPost('hello world!')
//     const tid = post.tid
//     await bob.likePost(alice.did, tid)
//     await carol.likePost(alice.did, tid)
//     await dan.likePost(alice.did, tid)
//   })

//   it('count likes on post', async () => {
//     const count = await alice.likeCount(alice.did, post.tid)
//     expect(count).toBe(3)
//   })
// })
