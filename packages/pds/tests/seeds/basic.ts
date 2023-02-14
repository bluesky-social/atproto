import { MessageQueue } from '../../src/event-stream/types'
import { SeedClient } from './client'
import usersSeed from './users'

export default async (sc: SeedClient, mq?: MessageQueue) => {
  await usersSeed(sc)

  const alice = sc.dids.alice
  const bob = sc.dids.bob
  const carol = sc.dids.carol
  const dan = sc.dids.dan

  await sc.follow(alice, sc.actorRef(bob))
  await sc.follow(alice, sc.actorRef(carol))
  await sc.follow(alice, sc.actorRef(dan))
  await sc.follow(carol, sc.actorRef(alice))
  await sc.follow(bob, sc.actorRef(alice))
  await sc.follow(bob, sc.actorRef(carol))
  await sc.follow(dan, sc.actorRef(bob))
  await sc.post(alice, posts.alice[0])
  await sc.post(bob, posts.bob[0])
  const img1 = await sc.uploadFile(
    carol,
    'tests/image/fixtures/key-landscape-small.jpg',
    'image/jpeg',
  )
  const img2 = await sc.uploadFile(
    carol,
    'tests/image/fixtures/key-alt.jpg',
    'image/jpeg',
  )
  await sc.post(carol, posts.carol[0], undefined, [img1, img2])
  await sc.post(dan, posts.dan[0])
  await sc.post(dan, posts.dan[1], [
    {
      index: { start: 0, end: 18 },
      type: 'mention',
      value: alice,
    },
  ])
  await sc.post(alice, posts.alice[1])
  await sc.post(bob, posts.bob[1])
  await sc.post(
    alice,
    posts.alice[2],
    undefined,
    undefined,
    sc.posts[dan][1].ref,
  )
  await sc.vote('up', bob, sc.posts[alice][1].ref)
  await sc.vote('down', bob, sc.posts[alice][2].ref)
  await sc.vote('down', carol, sc.posts[alice][1].ref)
  await sc.vote('up', carol, sc.posts[alice][2].ref)
  await sc.vote('up', dan, sc.posts[alice][1].ref)
  await sc.vote('up', alice, sc.posts[carol][0].ref)
  await sc.vote('up', bob, sc.posts[carol][0].ref)

  await mq?.processAll()

  const replyImg = await sc.uploadFile(
    bob,
    'tests/image/fixtures/key-landscape-small.jpg',
    'image/jpeg',
  )
  await sc.reply(
    bob,
    sc.posts[alice][1].ref,
    sc.posts[alice][1].ref,
    replies.bob[0],
    undefined,
    [replyImg],
  )
  await sc.reply(
    carol,
    sc.posts[alice][1].ref,
    sc.posts[alice][1].ref,
    replies.carol[0],
  )
  await sc.reply(
    alice,
    sc.posts[alice][1].ref,
    sc.replies[bob][0].ref,
    replies.alice[0],
  )
  await sc.repost(carol, sc.posts[dan][1].ref)
  await sc.repost(dan, sc.posts[alice][1].ref)

  await mq?.processAll()

  return sc
}

export const posts = {
  alice: ['hey there', 'again', 'yoohoo'],
  bob: ['bob back at it again!', 'bobby boy here', 'yoohoo'],
  carol: ['hi im carol'],
  dan: ['dan here!', '@alice.bluesky.xyz is the best'],
}

export const replies = {
  alice: ['thanks bob'],
  bob: ['hear that'],
  carol: ['of course'],
}
