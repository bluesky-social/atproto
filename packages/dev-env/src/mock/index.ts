import { AtUri } from '@atproto/syntax'
import AtpAgent from '@atproto/api'
import {
  REASONSPAM,
  REASONOTHER,
} from '@atproto/api/src/client/types/com/atproto/moderation/defs'
import { TestNetwork } from '../index'
import { postTexts, replyTexts } from './data'
import labeledImgB64 from './img/labeled-img-b64'
import blurHashB64 from './img/blur-hash-avatar-b64'

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

export async function generateMockSetup(env: TestNetwork) {
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

  let _i = 1
  for (const user of users) {
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

  const ctx = env.bsky.ctx
  if (ctx) {
    const labelSrvc = ctx.services.label(ctx.db.getPrimary())
    await labelSrvc.createLabels([
      {
        src: ctx.cfg.labelerDid,
        uri: labeledPost.uri,
        cid: labeledPost.cid,
        val: 'nudity',
        neg: false,
        cts: new Date().toISOString(),
      },
      {
        src: ctx.cfg.labelerDid,
        uri: filteredPost.uri,
        cid: filteredPost.cid,
        val: 'dmca-violation',
        neg: false,
        cts: new Date().toISOString(),
      },
    ])
  }

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
