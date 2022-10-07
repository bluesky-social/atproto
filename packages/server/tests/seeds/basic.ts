import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await sc.createAccount('alice', users.alice)
  await sc.createAccount('bob', users.bob)
  await sc.createAccount('carol', users.carol)
  await sc.createAccount('dan', users.dan)
  await sc.createProfile(
    sc.dids.alice,
    users.alice.displayName,
    users.alice.description,
  )
  await sc.createProfile(
    sc.dids.bob,
    users.bob.displayName,
    users.bob.description,
  )
  await sc.follow(sc.dids.alice, sc.dids.bob)
  await sc.follow(sc.dids.alice, sc.dids.carol)
  await sc.follow(sc.dids.alice, sc.dids.dan)
  await sc.follow(sc.dids.carol, sc.dids.alice)
  await sc.follow(sc.dids.bob, sc.dids.alice)
  await sc.follow(sc.dids.bob, sc.dids.carol)
  await sc.follow(sc.dids.dan, sc.dids.bob)
  await sc.post(sc.dids.alice, posts.alice[0])
  await sc.post(sc.dids.bob, posts.bob[0])
  await sc.post(sc.dids.carol, posts.carol[0])
  await sc.post(sc.dids.dan, posts.dan[0])
  await sc.post(sc.dids.dan, posts.dan[1], [
    {
      index: [0, 18],
      type: 'mention',
      value: sc.dids.alice,
    },
  ])
  await sc.post(sc.dids.alice, posts.alice[1])
  await sc.post(sc.dids.bob, posts.bob[1])
  await sc.post(sc.dids.alice, posts.alice[2])
  await sc.like(sc.dids.bob, sc.posts[sc.dids.alice][1].uriRaw)
  await sc.like(sc.dids.bob, sc.posts[sc.dids.alice][2].uriRaw)
  await sc.like(sc.dids.carol, sc.posts[sc.dids.alice][1].uriRaw)
  await sc.like(sc.dids.carol, sc.posts[sc.dids.alice][2].uriRaw)
  await sc.like(sc.dids.dan, sc.posts[sc.dids.alice][1].uriRaw)
  await sc.reply(
    sc.dids.bob,
    sc.posts[sc.dids.alice][1].uri,
    sc.posts[sc.dids.alice][1].uri,
    replies.bob[0],
  )
  await sc.reply(
    sc.dids.carol,
    sc.posts[sc.dids.alice][1].uri,
    sc.posts[sc.dids.alice][1].uri,
    replies.carol[0],
  )
  await sc.reply(
    sc.dids.alice,
    sc.posts[sc.dids.alice][1].uri,
    sc.replies[sc.dids.bob][0].uri,
    replies.alice[0],
  )
  await sc.repost(sc.dids.carol, sc.posts[sc.dids.dan][1].uriRaw)
  await sc.repost(sc.dids.dan, sc.posts[sc.dids.alice][1].uriRaw)
  return sc
}

const users = {
  alice: {
    email: 'alice@test.com',
    username: 'alice.test',
    password: 'alice-pass',
    displayName: 'ali',
    description: 'its me!',
  },
  bob: {
    email: 'bob@test.com',
    username: 'bob.test',
    password: 'bob-pass',
    displayName: 'bobby',
    description: 'hi im bob',
  },
  carol: {
    email: 'carol@test.com',
    username: 'carol.test',
    password: 'carol-pass',
    displayName: undefined,
    description: undefined,
  },
  dan: {
    email: 'dan@test.com',
    username: 'dan.test',
    password: 'dan-pass',
    displayName: undefined,
    description: undefined,
  },
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
