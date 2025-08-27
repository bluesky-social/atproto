import { AtpAgent, COM_ATPROTO_MODERATION } from '@atproto/api'
import { Database } from '@atproto/bsky'
import { AtUri } from '@atproto/syntax'
import { EXAMPLE_LABELER, RecordRef, TestNetwork } from '../index'
import * as seedThreadV2 from '../seed/thread-v2'
import { postTexts, replyTexts } from './data'
import blurHashB64 from './img/blur-hash-avatar-b64'
import labeledImgB64 from './img/labeled-img-b64'

// NOTE
// deterministic date generator
// we use this to ensure the mock dataset is always the same
// which is very useful when testing
// (not everything is currently deterministic but it could be)
function* dateGen(): Generator<string, never> {
  let start = 1657846031914
  while (true) {
    yield new Date(start).toISOString()
    start += 1e3
  }
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

  const loggedOut = env.pds.getClient()

  const users = [
    {
      email: 'alice@test.com',
      handle: `alice.test`,
      password: 'hunter2',
    },
    {
      email: 'bob@test.com',
      handle: `bob.test`,
      password: 'hunter2',
    },
    {
      email: 'carla@test.com',
      handle: `carla.test`,
      password: 'hunter2',
    },
  ]

  const userAgents = await Promise.all(
    users.map(async (user, i) => {
      const client: AtpAgent = env.pds.getClient()
      await client.createAccount(user)
      client.assertAuthenticated()
      await client.app.bsky.actor.profile.create(
        { repo: client.did },
        {
          displayName: ucfirst(user.handle).slice(0, -5),
          description: `Test user ${i}`,
        },
      )
      return client
    }),
  )

  const [alice, bob, carla] = userAgents

  // Create moderator accounts
  const triageRes = await loggedOut.com.atproto.server.createAccount({
    email: 'triage@test.com',
    handle: 'triage.test',
    password: 'triage-pass',
  })
  await env.ozone.addTriageDid(triageRes.data.did)
  const modRes = await loggedOut.com.atproto.server.createAccount({
    email: 'mod@test.com',
    handle: 'mod.test',
    password: 'mod-pass',
  })
  await env.ozone.addModeratorDid(modRes.data.did)
  const adminRes = await loggedOut.com.atproto.server.createAccount({
    email: 'admin-mod@test.com',
    handle: 'admin-mod.test',
    password: 'admin-mod-pass',
  })
  await env.ozone.addAdminDid(adminRes.data.did)

  // Report one user
  const reporter = picka(userAgents)
  await reporter.com.atproto.moderation.createReport({
    reasonType: picka([
      COM_ATPROTO_MODERATION.DefsReasonSpam,
      COM_ATPROTO_MODERATION.DefsReasonOther,
    ]),
    reason: picka(["Didn't look right to me", undefined, undefined]),
    subject: {
      $type: 'com.atproto.admin.defs#repoRef',
      did: picka(userAgents).did,
    },
  })

  // everybody follows everybody
  const follow = async (author: AtpAgent, subject: AtpAgent) => {
    await author.app.bsky.graph.follow.create(
      { repo: author.accountDid },
      {
        subject: subject.accountDid,
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
    const author = picka(userAgents)
    const post = await author.app.bsky.feed.post.create(
      { repo: author.did },
      {
        text: postTexts[i],
        createdAt: date.next().value,
      },
    )
    posts.push(post)
    if (rand(10) === 0) {
      const reposter = picka(userAgents)
      await reposter.app.bsky.feed.repost.create(
        { repo: reposter.did },
        {
          subject: picka(posts),
          createdAt: date.next().value,
        },
      )
    }
    if (rand(6) === 0) {
      const reporter = picka(userAgents)
      await reporter.com.atproto.moderation.createReport({
        reasonType: picka([
          COM_ATPROTO_MODERATION.DefsReasonSpam,
          COM_ATPROTO_MODERATION.DefsReasonOther,
        ]),
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
  const uploadedImg = await bob.com.atproto.repo.uploadBlob(file, {
    encoding: 'image/png',
  })
  const labeledPost = await bob.app.bsky.feed.post.create(
    { repo: bob.accountDid },
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

  const filteredPost = await bob.app.bsky.feed.post.create(
    { repo: bob.accountDid },
    {
      text: 'really bad post should be deleted',
      createdAt: date.next().value,
    },
  )

  await createLabel(env.bsky.db, {
    uri: labeledPost.uri,
    cid: labeledPost.cid,
    val: 'nudity',
  })
  await createLabel(env.bsky.db, {
    uri: filteredPost.uri,
    cid: filteredPost.cid,
    val: 'dmca-violation',
  })

  // a set of replies
  for (let i = 0; i < 100; i++) {
    const targetUri = picka(posts).uri
    const urip = new AtUri(targetUri)
    const target = await alice.app.bsky.feed.post.get({
      repo: urip.host,
      rkey: urip.rkey,
    })
    const author = picka(userAgents)
    posts.push(
      await author.app.bsky.feed.post.create(
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
    for (const user of userAgents) {
      if (rand(3) === 0) {
        await user.app.bsky.feed.like.create(
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
  const fg1Uri = AtUri.make(
    alice.accountDid,
    'app.bsky.feed.generator',
    'alice-favs',
  )
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
  const avatarRes = await alice.com.atproto.repo.uploadBlob(avatarImg, {
    encoding: 'image/png',
  })
  const fgAliceRes = await alice.app.bsky.feed.generator.create(
    { repo: alice.accountDid, rkey: fg1Uri.rkey },
    {
      did: fg1.did,
      displayName: 'alices feed',
      description: 'all my fav stuff',
      avatar: avatarRes.data.blob,
      createdAt: date.next().value,
    },
  )

  await alice.app.bsky.feed.post.create(
    { repo: alice.accountDid },
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
    await user.app.bsky.feed.like.create(
      { repo: user.did },
      {
        subject: fgAliceRes,
        createdAt: date.next().value,
      },
    )
  }

  const fg2Uri = AtUri.make(
    bob.accountDid,
    'app.bsky.feed.generator',
    'bob-redux',
  )
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
  const fgBobRes = await bob.app.bsky.feed.generator.create(
    { repo: bob.accountDid, rkey: fg2Uri.rkey },
    {
      did: fg2.did,
      displayName: 'Bobby boy hot new algo',
      createdAt: date.next().value,
    },
  )

  await alice.app.bsky.feed.post.create(
    { repo: alice.accountDid },
    {
      text: `bobs feed is neat too`,
      embed: {
        $type: 'app.bsky.embed.record',
        record: fgBobRes,
      },
      createdAt: date.next().value,
    },
  )

  const fg3Uri = AtUri.make(
    carla.accountDid,
    'app.bsky.feed.generator',
    'carla-intr-algo',
  )
  const fg3 = await env.createFeedGen({
    [fg3Uri.toString()]: async () => {
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
  const fgCarlaRes = await carla.app.bsky.feed.generator.create(
    { repo: carla.accountDid, rkey: fg3Uri.rkey },
    {
      did: fg3.did,
      displayName: `Acceptin' Generator`,
      acceptsInteractions: true,
      createdAt: date.next().value,
    },
  )

  await alice.app.bsky.feed.post.create(
    { repo: alice.accountDid },
    {
      text: `carla accepts interactions on her feed`,
      embed: {
        $type: 'app.bsky.embed.record',
        record: fgCarlaRes,
      },
      createdAt: date.next().value,
    },
  )

  // create a labeler account
  {
    const labeler = env.pds.getClient()
    const res = await labeler.createAccount({
      email: 'labeler@test.com',
      handle: 'labeler.test',
      password: 'hunter2',
    })
    await labeler.app.bsky.actor.profile.create(
      { repo: res.data.did },
      {
        displayName: 'Test Labeler',
        description: `Labeling things across the atmosphere`,
      },
    )

    await labeler.app.bsky.labeler.service.create(
      { repo: res.data.did, rkey: 'self' },
      {
        policies: {
          labelValues: [
            '!hide',
            'porn',
            'rude',
            'spam',
            'spider',
            'misinfo',
            'cool',
            'curate',
          ],
          labelValueDefinitions: [
            {
              identifier: 'rude',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: true,
              locales: [
                {
                  lang: 'en',
                  name: 'Rude',
                  description: 'Just such a jerk, you wouldnt believe it.',
                },
              ],
            },
            {
              identifier: 'spam',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              locales: [
                {
                  lang: 'en',
                  name: 'Spam',
                  description:
                    'Low quality posts that dont add to the conversation.',
                },
              ],
            },
            {
              identifier: 'spider',
              blurs: 'media',
              severity: 'alert',
              defaultSetting: 'warn',
              locales: [
                {
                  lang: 'en',
                  name: 'Spider!',
                  description: 'Oh no its a spider.',
                },
              ],
            },
            {
              identifier: 'cool',
              blurs: 'none',
              severity: 'inform',
              defaultSetting: 'warn',
              locales: [
                {
                  lang: 'en',
                  name: 'Cool',
                  description: 'The coolest peeps in the atmosphere.',
                },
              ],
            },
            {
              identifier: 'curate',
              blurs: 'none',
              severity: 'none',
              defaultSetting: 'warn',
              locales: [
                {
                  lang: 'en',
                  name: 'Curation filter',
                  description: 'We just dont want to see it as much.',
                },
              ],
            },
          ],
        },
        createdAt: date.next().value,
      },
    )
    await createLabel(env.bsky.db, {
      uri: alice.accountDid,
      cid: '',
      val: 'rude',
      src: res.data.did,
    })
    await createLabel(env.bsky.db, {
      uri: `at://${alice.accountDid}/app.bsky.feed.generator/alice-favs`,
      cid: '',
      val: 'cool',
      src: res.data.did,
    })
    await createLabel(env.bsky.db, {
      uri: bob.accountDid,
      cid: '',
      val: 'cool',
      src: res.data.did,
    })
    await createLabel(env.bsky.db, {
      uri: carla.accountDid,
      cid: '',
      val: 'spam',
      src: res.data.did,
    })
  }

  // Create lists and add people to the lists
  {
    const flowerLovers = await alice.app.bsky.graph.list.create(
      { repo: alice.accountDid },
      {
        name: 'Flower Lovers',
        purpose: 'app.bsky.graph.defs#curatelist',
        createdAt: new Date().toISOString(),
        description: 'A list of posts about flowers',
      },
    )
    const labelHaters = await bob.app.bsky.graph.list.create(
      { repo: bob.accountDid },
      {
        name: 'Label Haters',
        purpose: 'app.bsky.graph.defs#modlist',
        createdAt: new Date().toISOString(),
        description: 'A list of people who hate labels',
      },
    )
    await alice.app.bsky.graph.listitem.create(
      { repo: alice.accountDid },
      {
        subject: bob.accountDid,
        createdAt: new Date().toISOString(),
        list: new RecordRef(flowerLovers.uri, flowerLovers.cid).uriStr,
      },
    )
    await bob.app.bsky.graph.listitem.create(
      { repo: bob.accountDid },
      {
        subject: alice.accountDid,
        createdAt: new Date().toISOString(),
        list: new RecordRef(labelHaters.uri, labelHaters.cid).uriStr,
      },
    )
  }

  await setVerifier(env.bsky.db, alice.accountDid)

  // @TODO the following should be optimized as it makes dev-env start very slow (>10 sec)
  const sc = env.getSeedClient()
  await seedThreadV2.simple(sc)
  await seedThreadV2.long(sc)
  await seedThreadV2.deep(sc)
  await seedThreadV2.branchingFactor(sc)
  await seedThreadV2.annotateMoreReplies(sc)
  await seedThreadV2.annotateOP(sc)
  await seedThreadV2.sort(sc)
  await seedThreadV2.bumpOpAndViewer(sc)
  await seedThreadV2.bumpGroupSorting(sc)
  await seedThreadV2.bumpFollows(sc)
  await seedThreadV2.blockDeletionAuth(sc, env.bsky.ctx.cfg.modServiceDid)
  await seedThreadV2.mutes(sc)
  await seedThreadV2.threadgated(sc)
  await seedThreadV2.tags(sc)
}

function ucfirst(str: string): string {
  return str.at(0)?.toUpperCase() + str.slice(1)
}

const createLabel = async (
  db: Database,
  opts: { uri: string; cid: string; val: string; src?: string },
) => {
  await db.db
    .insertInto('label')
    .values({
      uri: opts.uri,
      cid: opts.cid,
      val: opts.val,
      cts: new Date().toISOString(),
      neg: false,
      src: opts.src ?? EXAMPLE_LABELER,
    })
    .execute()
}

const setVerifier = async (db: Database, did: string) => {
  await db.db
    .updateTable('actor')
    .set({ trustedVerifier: true })
    .where('did', '=', did)
    .execute()
}
