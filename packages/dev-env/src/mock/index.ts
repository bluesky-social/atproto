import { AtUri } from '@atproto/uri'
import AtpAgent from '@waverlyai/atproto-api'
import {
  REASONSPAM,
  REASONOTHER,
} from '@atproto/api/src/client/types/com/atproto/moderation/defs'
import { TestNetworkNoAppView } from '../index'
import { postTexts, replyTexts } from './data'
import labeledImgB64 from './img/labeled-img-b64'
import blurHashB64 from './img/blur-hash-avatar-b64'
import * as waverly from './waverly'

// NOTE
// deterministic date generator
// we use this to ensure the mock dataset is always the same
// which is very useful when testing
// (not everything is currently deterministic but it could be)
function* dateGen() {
  let start = 1657846031914
  while (true) {
    yield new Date(start).toISOString()
    start += 1e3
  }
  return ''
}

export async function generateMockSetup(env: TestNetworkNoAppView) {
  const date = dateGen()

  const rand = (n: number) => Math.floor(Math.random() * n)
  const picka = <T>(arr: Array<T>): T => {
    if (arr.length) {
      return arr[rand(arr.length)] || arr[0]
    }
    throw new Error('Not found')
  }

  const clients = {
    loggedout: env.pds.getClient(),
    alice: env.pds.getClient(),
    bob: env.pds.getClient(),
    carla: env.pds.getClient(),
    phil: env.pds.getClient(),
    dave: env.pds.getClient(),
    kira: env.pds.getClient(),
    aman: env.pds.getClient(),
  }
  interface User {
    email: string
    did: string
    handle: string
    password: string
    agent: AtpAgent
  }
  const users: User[] = [
    {
      email: 'alice@test.com',
      did: '',
      handle: `alice.test`,
      password: 'hunter2',
      agent: clients.alice,
    },
    {
      email: 'bob@test.com',
      did: '',
      handle: `bob.test`,
      password: 'hunter2',
      agent: clients.bob,
    },
    {
      email: 'carla@test.com',
      did: '',
      handle: `carla.test`,
      password: 'hunter2',
      agent: clients.carla,
    },
  ]
  const alice = users[0]
  const bob = users[1]
  const carla = users[2]

  const dUsers: User[] = [
    {
      email: 'dave@test.com',
      did: '',
      handle: `dave.test`,
      password: 'hunter2',
      agent: clients.dave,
    },
    {
      email: 'kira@test.com',
      did: '',
      handle: `kira.test`,
      password: 'hunter2',
      agent: clients.kira,
    },
    {
      email: 'phil@test.com',
      did: '',
      handle: `phil.test`,
      password: 'hunter2',
      agent: clients.phil,
    },
    {
      email: 'aman@test.com',
      did: '',
      handle: `aman.test`,
      password: 'hunter2',
      agent: clients.aman,
    },
  ]

  const dave = dUsers[0]
  const kira = dUsers[1]
  const phil = dUsers[2]
  const aman = dUsers[3]
  let _i = 1
  const groupUsers = waverly.genGroupUsers(env)
  const testUsers = [...users, ...groupUsers]
  const demoUsers = [...dUsers, ...groupUsers]
  const allUsers = Array.from(new Set([...testUsers, ...demoUsers]))
  for (const user of allUsers) {
    const res = await clients.loggedout.api.com.atproto.server.createAccount({
      email: user.email,
      handle: user.handle,
      password: user.password,
    })
    user.agent.api.setHeader('Authorization', `Bearer ${res.data.accessJwt}`)
    user.did = res.data.did
    await user.agent.api.app.bsky.actor.profile.create(
      { repo: user.did },
      {
        displayName: ucfirst(user.handle).slice(0, -5),
        description: `Test user ${_i++}`,
      },
    )
  }

  await waverly.updateUsers(allUsers)

  // Report one user
  const reporter = picka(users)
  await reporter.agent.api.com.atproto.moderation.createReport({
    reasonType: picka([REASONSPAM, REASONOTHER]),
    reason: picka(["Didn't look right to me", undefined, undefined]),
    subject: {
      $type: 'com.atproto.admin.defs#repoRef',
      did: picka(users).did,
    },
  })

  // everybody follows everybody
  const follow = async (author: User, subject: User) => {
    await author.agent.api.app.bsky.graph.follow.create(
      { repo: author.did },
      {
        subject: subject.did,
        createdAt: date.next().value,
      },
    )
  }
  await follow(alice, bob)
  await follow(alice, carla)
  await follow(bob, alice)
  await follow(bob, carla)
  await follow(carla, alice)
  await follow(carla, bob)

  await follow(phil, dave)
  await follow(phil, kira)
  await follow(phil, aman)

  await follow(dave, phil)
  await follow(dave, kira)
  await follow(dave, aman)

  await follow(kira, phil)
  await follow(kira, dave)
  await follow(kira, aman)

  await follow(aman, phil)
  await follow(aman, dave)
  await follow(aman, kira)

  for (const g of groupUsers) {
    if (g.handle === 'betterweb.group' || g.handle === 'testgroup.group')
      continue
    await follow(phil, g)
    await follow(dave, g)
    await follow(kira, g)
    await follow(aman, g)
  }

  // a set of posts and reposts
  const posts: { uri: string; cid: string }[] = []
  for (let i = 0; i < postTexts.length; i++) {
    const author = picka(users)
    const post = await author.agent.api.app.bsky.feed.post.create(
      { repo: author.did },
      {
        text: postTexts[i],
        createdAt: date.next().value,
      },
    )
    posts.push(post)
    if (rand(10) === 0) {
      const reposter = picka(users)
      await reposter.agent.api.app.bsky.feed.repost.create(
        { repo: reposter.did },
        {
          subject: picka(posts),
          createdAt: date.next().value,
        },
      )
    }
    if (rand(6) === 0) {
      const reporter = picka(users)
      await reporter.agent.api.com.atproto.moderation.createReport({
        reasonType: picka([REASONSPAM, REASONOTHER]),
        reason: picka(["Didn't look right to me", undefined, undefined]),
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uri,
          cid: post.cid,
        },
      })
    }
  }

  // make some naughty posts & label them
  const file = Buffer.from(labeledImgB64, 'base64')
  const uploadedImg = await bob.agent.api.com.atproto.repo.uploadBlob(file, {
    encoding: 'image/png',
  })
  const labeledPost = await bob.agent.api.app.bsky.feed.post.create(
    { repo: bob.did },
    {
      text: 'naughty post',
      embed: {
        $type: 'app.bsky.embed.images',
        images: [
          {
            image: uploadedImg.data.blob,
            alt: 'naughty naughty',
          },
        ],
      },
      createdAt: date.next().value,
    },
  )

  const filteredPost = await bob.agent.api.app.bsky.feed.post.create(
    { repo: bob.did },
    {
      text: 'reallly bad post should be deleted',
      createdAt: date.next().value,
    },
  )

  const ctx = env.pds.ctx
  if (ctx) {
    await ctx.db.db
      .insertInto('label')
      .values([
        {
          src: ctx.cfg.labelerDid,
          uri: labeledPost.uri,
          cid: labeledPost.cid,
          val: 'nudity',
          neg: 0,
          cts: new Date().toISOString(),
        },
        {
          src: ctx.cfg.labelerDid,
          uri: filteredPost.uri,
          cid: filteredPost.cid,
          val: 'dmca-violation',
          neg: 0,
          cts: new Date().toISOString(),
        },
      ])
      .execute()
  }

  await waverly.addGroupPosts(testUsers, date)
  await waverly.addDemoPosts(demoUsers, date)

  // a set of replies
  for (let i = 0; i < 100; i++) {
    const targetUri = picka(posts).uri
    const urip = new AtUri(targetUri)
    const target = await alice.agent.api.app.bsky.feed.post.get({
      repo: urip.host,
      rkey: urip.rkey,
    })
    const author = picka(users)
    posts.push(
      await author.agent.api.app.bsky.feed.post.create(
        { repo: author.did },
        {
          text: picka(replyTexts),
          reply: {
            root: target.value.reply ? target.value.reply.root : target,
            parent: target,
          },
          createdAt: date.next().value,
        },
      ),
    )
  }

  // a set of likes
  for (const post of posts) {
    for (const user of users) {
      if (rand(3) === 0) {
        await user.agent.api.app.bsky.feed.like.create(
          { repo: user.did },
          {
            subject: post,
            createdAt: date.next().value,
          },
        )
      }
    }
  }

  // a couple feed generators that returns some posts
  const fg1Uri = AtUri.make(alice.did, 'app.bsky.feed.generator', 'alice-favs')
  const fg1 = await env.createFeedGen({
    [fg1Uri.toString()]: async () => {
      const feed = posts
        .filter(() => rand(2) === 0)
        .map((post) => ({ post: post.uri }))
      return {
        encoding: 'application/json',
        body: {
          feed,
        },
      }
    },
  })
  const avatarImg = Buffer.from(blurHashB64, 'base64')
  const avatarRes = await alice.agent.api.com.atproto.repo.uploadBlob(
    avatarImg,
    {
      encoding: 'image/png',
    },
  )
  const fgAliceRes = await alice.agent.api.app.bsky.feed.generator.create(
    { repo: alice.did, rkey: fg1Uri.rkey },
    {
      did: fg1.did,
      displayName: 'alices feed',
      description: 'all my fav stuff',
      avatar: avatarRes.data.blob,
      createdAt: date.next().value,
    },
  )

  await alice.agent.api.app.bsky.feed.post.create(
    { repo: alice.did },
    {
      text: 'check out my algorithm!',
      embed: {
        $type: 'app.bsky.embed.record',
        record: fgAliceRes,
      },
      createdAt: date.next().value,
    },
  )
  for (const user of [alice, bob, carla]) {
    await user.agent.api.app.bsky.feed.like.create(
      { repo: user.did },
      {
        subject: fgAliceRes,
        createdAt: date.next().value,
      },
    )
  }

  const fg2Uri = AtUri.make(bob.did, 'app.bsky.feed.generator', 'bob-redux')
  const fg2 = await env.createFeedGen({
    [fg2Uri.toString()]: async () => {
      const feed = posts
        .filter(() => rand(2) === 0)
        .map((post) => ({ post: post.uri }))
      return {
        encoding: 'application/json',
        body: {
          feed,
        },
      }
    },
  })
  const fgBobRes = await bob.agent.api.app.bsky.feed.generator.create(
    { repo: bob.did, rkey: fg2Uri.rkey },
    {
      did: fg2.did,
      displayName: 'Bobby boy hot new algo',
      createdAt: date.next().value,
    },
  )

  await alice.agent.api.app.bsky.feed.post.create(
    { repo: alice.did },
    {
      text: `bobs feed is neat too`,
      embed: {
        $type: 'app.bsky.embed.record',
        record: fgBobRes,
      },
      createdAt: date.next().value,
    },
  )
}

function ucfirst(str: string): string {
  return str.at(0)?.toUpperCase() + str.slice(1)
}
