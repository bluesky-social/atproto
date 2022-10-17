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
  await sc.like(sc.dids.bob, sc.posts[sc.dids.alice][1].ref)
  await sc.like(sc.dids.bob, sc.posts[sc.dids.alice][2].ref)
  await sc.like(sc.dids.carol, sc.posts[sc.dids.alice][1].ref)
  await sc.like(sc.dids.carol, sc.posts[sc.dids.alice][2].ref)
  await sc.like(sc.dids.dan, sc.posts[sc.dids.alice][1].ref)
  await sc.reply(
    sc.dids.bob,
    sc.posts[sc.dids.alice][1].ref,
    sc.posts[sc.dids.alice][1].ref,
    replies.bob[0],
  )
  await sc.reply(
    sc.dids.carol,
    sc.posts[sc.dids.alice][1].ref,
    sc.posts[sc.dids.alice][1].ref,
    replies.carol[0],
  )
  await sc.reply(
    sc.dids.alice,
    sc.posts[sc.dids.alice][1].ref,
    sc.replies[sc.dids.bob][0].ref,
    replies.alice[0],
  )
  await sc.repost(sc.dids.carol, sc.posts[sc.dids.dan][1].ref)
  await sc.repost(sc.dids.dan, sc.posts[sc.dids.alice][1].ref)

  await sc.createBadge(sc.dids.bob, 'employee')
  await sc.createBadge(sc.dids.bob, 'tag', 'cool')
  await sc.createBadge(sc.dids.carol, 'tag', 'neat')
  await sc.createBadge(sc.dids.carol, 'tag', 'cringe')

  await sc.offerBadge(sc.dids.bob, sc.dids.alice, sc.badges[sc.dids.bob][0])
  await sc.offerBadge(sc.dids.bob, sc.dids.alice, sc.badges[sc.dids.bob][1])
  await sc.offerBadge(sc.dids.bob, sc.dids.bob, sc.badges[sc.dids.bob][1])
  await sc.offerBadge(sc.dids.bob, sc.dids.carol, sc.badges[sc.dids.bob][1])
  await sc.offerBadge(sc.dids.bob, sc.dids.dan, sc.badges[sc.dids.bob][1])
  await sc.offerBadge(sc.dids.carol, sc.dids.alice, sc.badges[sc.dids.carol][0])

  await sc.acceptBadge(
    sc.dids.alice,
    sc.badges[sc.dids.bob][1],
    sc.badgeOffers[sc.dids.bob][sc.dids.alice][1],
  )
  await sc.acceptBadge(
    sc.dids.bob,
    sc.badges[sc.dids.bob][1],
    sc.badgeOffers[sc.dids.bob][sc.dids.bob][0],
  )
  await sc.acceptBadge(
    sc.dids.carol,
    sc.badges[sc.dids.bob][1],
    sc.badgeOffers[sc.dids.bob][sc.dids.carol][0],
  )
  await sc.acceptBadge(
    sc.dids.alice,
    sc.badges[sc.dids.carol][0],
    sc.badgeOffers[sc.dids.carol][sc.dids.alice][0],
  )

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
