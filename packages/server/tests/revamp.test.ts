import { AdxUri } from '@adxp/common'
import MicroblogClient from './client'

const url = 'http://localhost:2583'
const alice = new MicroblogClient(url, 'did:example:alice')
const bob = new MicroblogClient(url, 'did:example:bob')
const carol = new MicroblogClient(url, 'did:example:carol')
const dan = new MicroblogClient(url, 'did:example:dan')

let alicePosts: AdxUri[] = []
let danPosts: AdxUri[] = []

describe('server', () => {
  it('register users', async () => {
    await alice.register('alice')
    await bob.register('bob')
    await carol.register('carol')
    await dan.register('dan')
  })

  it('creates profiles', async () => {
    await alice.createProfile('ali', 'its me!')
    await bob.createProfile('bobby', 'hi im bob')
  })

  it('follow people', async () => {
    await alice.followUser(bob.did)
    await alice.followUser(carol.did)
    await alice.followUser(dan.did)
    await bob.followUser(alice.did)
    await bob.followUser(carol.did)
  })

  it('makes some posts', async () => {
    const alice1 = await alice.createPost('hey there')
    await carol.createPost('hi im carol')
    const dan1 = await dan.createPost('dan here')
    const dan2 = await dan.createPost('carol is the best!')
    const alice2 = await alice.createPost('again')
    const alice3 = await alice.createPost('yoohoo')
    alicePosts = [alice1, alice2, alice3]
    danPosts = [dan1, dan2]
  })

  it('likes a post', async () => {
    await bob.likePost(alicePosts[1])
    await bob.likePost(alicePosts[2])
  })

  it('replies to a post', async () => {
    await bob.reply(alicePosts[1], alicePosts[1], 'hear that')
    await carol.reply(alicePosts[1], alicePosts[1], 'of course')
  })

  it('reposts a post', async () => {
    await carol.repost(danPosts[1])
  })

  it('fetches followers', async () => {
    const followers = await alice.getFollowers('alice')
    console.log(followers)
  })

  it('fetches follows', async () => {
    const follows = await alice.getFollows('alice')
    console.log(follows)
  })

  it('fetches profile', async () => {
    const profile = await alice.getProfile('alice')
    console.log(profile)
  })

  it('fetches feed', async () => {
    const feed = await bob.getFeed()
    console.log(feed)
  })

  it('fetches postThread', async () => {
    const thread = await bob.getPostThread(alicePosts[1])
    console.log(thread.replies)
  })

  return

  // it('fetches liked by view', async () => {
  //   const view = await alice.getLikesForPost(postUri)
  //   console.log(view)
  // })

  // it('fetches liked by view', async () => {
  //   const view = await alice.getLikesForPost(postUri)
  //   console.log(view)
  // })
})
