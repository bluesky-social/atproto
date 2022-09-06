import { isPost } from '@adxp/microblog'
import MicroblogClient from './client'

const url = 'http://localhost:2583'
const alice = new MicroblogClient(url, 'did:example:alice')
const bob = new MicroblogClient(url, 'did:example:bob')
const carol = new MicroblogClient(url, 'did:example:carol')
const dan = new MicroblogClient(url, 'did:example:dan')

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
    await alice.createPost('hey there')
    await carol.createPost('hi im carol')
    await dan.createPost('dan here')
    await alice.createPost('again')
    await alice.createPost('yoohoo')
  })

  let postUri: string

  it('retrieves posts', async () => {
    const posts = await alice.listPosts()
    expect(isPost(posts[0])).toBeTruthy()
    postUri = posts[0].uri
  })

  it('likes a post', async () => {
    await bob.likePost(postUri)
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

  return

  it('fetches liked by view', async () => {
    const view = await alice.getLikesForPost(postUri)
    console.log(view)
  })

  it('fetches liked by view', async () => {
    const view = await alice.getLikesForPost(postUri)
    console.log(view)
  })
})
