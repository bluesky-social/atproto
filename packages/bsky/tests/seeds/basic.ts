import { ids } from '../../src/lexicon/lexicons'
import { SeedClient } from './client'
import usersSeed from './users'

export default async (sc: SeedClient, users = true) => {
  if (users) await usersSeed(sc)

  const alice = sc.dids.alice
  const bob = sc.dids.bob
  const carol = sc.dids.carol
  const dan = sc.dids.dan

  await sc.follow(alice, bob)
  await sc.follow(alice, carol)
  await sc.follow(alice, dan)
  await sc.follow(carol, alice)
  await sc.follow(bob, alice)
  await sc.follow(bob, carol)
  await sc.follow(dan, bob)
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
  await sc.post(
    carol,
    posts.carol[0],
    undefined,
    [img1, img2], // Contains both images and a quote
    sc.posts[bob][0].ref,
  )
  await sc.post(dan, posts.dan[0])
  await sc.post(
    dan,
    posts.dan[1],
    [
      {
        index: { byteStart: 0, byteEnd: 18 },
        features: [
          {
            $type: `${ids.AppBskyRichtextFacet}#mention`,
            did: alice,
          },
        ],
      },
    ],
    undefined,
    sc.posts[carol][0].ref, // This post contains an images embed
  )
  await sc.post(alice, posts.alice[1])
  await sc.post(bob, posts.bob[1])
  await sc.post(
    alice,
    posts.alice[2],
    undefined,
    undefined,
    sc.posts[dan][1].ref, // This post contains a record embed which contains an images embed
  )
  await sc.like(bob, sc.posts[alice][1].ref)
  await sc.like(bob, sc.posts[alice][2].ref)
  await sc.like(carol, sc.posts[alice][1].ref)
  await sc.like(carol, sc.posts[alice][2].ref)
  await sc.like(dan, sc.posts[alice][1].ref)
  await sc.like(alice, sc.posts[carol][0].ref)
  await sc.like(bob, sc.posts[carol][0].ref)

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

  return sc
}

export const posts = {
  alice: ['hey there', 'again', 'yoohoo label_me'],
  bob: ['bob back at it again!', 'bobby boy here', 'yoohoo'],
  carol: ['hi im carol'],
  dan: ['dan here!', '@alice.bluesky.xyz is the best'],
}

export const replies = {
  alice: ['thanks bob'],
  bob: ['hear that label_me label_me_2'],
  carol: ['of course'],
}
