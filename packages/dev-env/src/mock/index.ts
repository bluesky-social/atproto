import type { Database } from '@atproto/bsky'
import {
  Client,
  type DatetimeString,
  type DidString,
  type HandleString,
  currentDatetimeString,
  toDatetimeString,
} from '@atproto/lex'
import { PasswordSession } from '@atproto/lex-password-session'
import { AtUri, type AtUriString } from '@atproto/syntax'
import { EXAMPLE_LABELER, RecordRef, type TestNetwork } from '../index.js'
import { app, chat, com, tools } from '../lexicons/index.js'
import { postTexts, replyTexts } from './data.js'
import blurHashB64 from './img/blur-hash-avatar-b64.js'
import labeledImgB64 from './img/labeled-img-b64.js'

const REASON_SPAM = 'com.atproto.moderation.defs#reasonSpam'
const REASON_OTHER = 'com.atproto.moderation.defs#reasonOther'

// NOTE
// deterministic date generator
// we use this to ensure the mock dataset is always the same
// which is very useful when testing
// (not everything is currently deterministic but it could be)
function* dateGen(): Generator<DatetimeString, never> {
  let start = 1657846031914
  while (true) {
    yield toDatetimeString(new Date(start))
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

  const users: {
    email: string
    handle: HandleString
    password: string
    displayName?: string
    description?: string
  }[] = [
    {
      email: 'alice@test.com',
      handle: `alice.test`,
      password: 'hunter2',
      displayName: 'Alice',
      description: 'Test user 0',
    },
    {
      email: 'bob@test.com',
      handle: `bob.test`,
      password: 'hunter2',
      displayName: 'Bob',
      description: 'Test user 1',
    },
    {
      email: 'carla@test.com',
      handle: `carla.test`,
      password: 'hunter2',
      displayName: 'Carla',
      description: 'Test user 2',
    },
    {
      email: 'triage@test.com',
      handle: 'triage.test',
      password: 'triage-pass',
    },
    {
      email: 'mod@test.com',
      handle: 'mod.test',
      password: 'mod-pass',
    },
    {
      email: 'admin-mod@test.com',
      handle: 'admin-mod.test',
      password: 'admin-mod-pass',
    },
    {
      email: 'labeler@test.com',
      handle: 'labeler.test',
      password: 'hunter2',
      displayName: 'Test Labeler',
      description: 'Labeling things across the atmosphere',
    },
  ]

  const userClients = await Promise.all(
    users.map(async (user) => {
      const session = await PasswordSession.createAccount(user, {
        service: env.pds.url,
      })
      const client: Client = new Client(session)
      if (user.displayName || user.description) {
        await client.create(app.bsky.actor.profile, {
          displayName: user.displayName,
          description: user.description,
        })
      }
      return client
    }),
  )

  const [alice, bob, carla, triage, mod, adminMod, labeler] = userClients

  // Create chat declarations for all users
  for (const user of userClients) {
    await user.create(chat.bsky.actor.declaration, { allowIncoming: 'all' })
  }

  // Add moderator roles
  await env.ozone.addTriageDid(triage.assertDid)
  await env.ozone.addModeratorDid(mod.assertDid)
  await env.ozone.addAdminDid(adminMod.assertDid)

  // Create report queues
  const ozoneClient = env.ozone.getClient()
  const adminHeaders = async (nsid: string) =>
    env.ozone.modHeaders(nsid, 'admin')

  const createQueue = async (
    input: tools.ozone.queue.createQueue.$InputBody,
  ): Promise<void> => {
    const res = await ozoneClient.xrpcSafe(tools.ozone.queue.createQueue, {
      body: input,
      headers: await adminHeaders('tools.ozone.queue.createQueue'),
    })
    if (!res.success && res.error !== 'ConflictingQueue') {
      throw res.reason
    }
  }

  await Promise.all([
    createQueue({
      name: 'Spammy Accounts',
      subjectTypes: ['account'],
      reportTypes: [REASON_SPAM],
    }),
    createQueue({
      name: 'Threatening Accounts',
      subjectTypes: ['account'],
      reportTypes: ['tools.ozone.report.defs#reasonViolenceThreats'],
    }),
    createQueue({
      name: 'Spammy Posts',
      subjectTypes: ['record'],
      reportTypes: [REASON_SPAM],
      collection: 'app.bsky.feed.post',
    }),
  ])

  // Report one user (random)
  const reporter = picka(userClients)
  await reporter.call(com.atproto.moderation.createReport, {
    reasonType: picka([REASON_SPAM, REASON_OTHER]),
    reason: picka(["Didn't look right to me", undefined, undefined]),
    subject: {
      $type: 'com.atproto.admin.defs#repoRef',
      did: picka(userClients).assertDid,
    },
  })

  // Reports that target queues
  await alice.call(com.atproto.moderation.createReport, {
    reasonType: REASON_SPAM,
    reason: 'This account is spamming',
    subject: { $type: 'com.atproto.admin.defs#repoRef', did: bob.assertDid },
  })
  await bob.call(com.atproto.moderation.createReport, {
    reasonType: 'tools.ozone.report.defs#reasonViolenceThreats',
    reason: 'Threatened me',
    subject: {
      $type: 'com.atproto.admin.defs#repoRef',
      did: carla.assertDid,
    },
  })

  // everybody follows everybody
  const follow = async (author: Client, subject: Client) => {
    await author.create(app.bsky.graph.follow, {
      subject: subject.assertDid,
      createdAt: date.next().value,
    })
  }
  await follow(alice, bob)
  await follow(alice, carla)
  await follow(bob, alice)
  await follow(bob, carla)
  await follow(carla, alice)
  await follow(carla, bob)

  // a set of posts and reposts
  const posts: { uri: AtUriString; cid: string }[] = []
  for (let i = 0; i < postTexts.length; i++) {
    const author = picka(userClients)
    const post = await author.create(app.bsky.feed.post, {
      text: postTexts[i],
      createdAt: date.next().value,
    })
    posts.push(post)
    if (rand(10) === 0) {
      const reposter = picka(userClients)
      await reposter.create(app.bsky.feed.repost, {
        subject: picka(posts),
        createdAt: date.next().value,
      })
    }
    if (rand(6) === 0) {
      const reporter = picka(userClients)
      await reporter.call(com.atproto.moderation.createReport, {
        reasonType: picka([REASON_SPAM, REASON_OTHER]),
        reason: picka(["Didn't look right to me", undefined, undefined]),
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: post.uri,
          cid: post.cid,
        },
      })
    }
  }

  // Spam post report
  if (posts.length > 0) {
    await carla.call(com.atproto.moderation.createReport, {
      reasonType: REASON_SPAM,
      reason: 'This post is spam',
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: posts[0].uri,
        cid: posts[0].cid,
      },
    })
  }

  // Route all reports to queues
  await env.ozone.daemon.ctx.queueRouter.routeReports()

  // make some naughty posts & label them
  const file = Buffer.from(labeledImgB64, 'base64')
  const uploadedImg = await bob.uploadBlob(file, {
    encoding: 'image/png',
  })
  const labeledPost = await bob.create(app.bsky.feed.post, {
    text: 'naughty post',
    embed: {
      $type: 'app.bsky.embed.images',
      images: [
        {
          image: uploadedImg.body.blob,
          alt: 'naughty naughty',
        },
      ],
    },
    createdAt: date.next().value,
  })

  const filteredPost = await bob.create(app.bsky.feed.post, {
    text: 'really bad post should be deleted',
    createdAt: date.next().value,
  })

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

  // post with a gallery of images
  const galleryItems: Array<any> = []
  for (let i = 0; i < 10; i++) {
    galleryItems.push({
      $type: 'app.bsky.embed.gallery#image',
      image: uploadedImg.body.blob,
      alt: 'naughty ' + (i + 1),
      aspectRatio: {
        $type: 'app.bsky.embed.defs#aspectRatio',
        width: 10,
        height: 10,
      },
    })
  }
  const galleryPost = await bob.create(app.bsky.feed.post, {
    text: 'look at my cool pics',
    embed: {
      $type: 'app.bsky.embed.gallery',
      items: galleryItems,
    },
    createdAt: date.next().value,
  })
  posts.push(galleryPost)

  // a set of replies
  for (let i = 0; i < 100; i++) {
    const targetUri = picka(posts).uri
    const urip = new AtUri(targetUri)
    const target = await alice.get(app.bsky.feed.post, {
      repo: urip.host,
      rkey: urip.rkey,
    })
    // `getRecord` only omits the CID when the record is served without one,
    // which a strong ref can't reference.
    if (!target.cid) continue
    const targetRef = { uri: target.uri, cid: target.cid }
    const author = picka(userClients)
    try {
      const post = await author.create(app.bsky.feed.post, {
        text: picka(replyTexts),
        reply: {
          root: target.value.reply?.root ?? targetRef,
          parent: targetRef,
        },
        createdAt: date.next().value,
      })

      posts.push(post)
    } catch (err) {
      // @TODO Investigate why this sometimes fails.
      console.error('Failed to create reply', err)
    }
  }

  // a set of likes
  for (const post of posts) {
    for (const user of userClients) {
      if (rand(3) === 0) {
        await user.create(app.bsky.feed.like, {
          subject: post,
          createdAt: date.next().value,
        })
      }
    }
  }

  // a couple feed generators that returns some posts
  const fg1Uri = AtUri.make(
    alice.assertDid,
    'app.bsky.feed.generator',
    'alice-favs',
  )
  const fg1 = await env.createFeedGen({
    [fg1Uri.toString()]: async () => {
      const feed = posts
        .filter(() => rand(2) === 0)
        .map((post) => ({ post: post.uri as AtUriString }))
      return {
        encoding: 'application/json',
        body: {
          feed,
        },
      }
    },
  })
  const avatarImg = Buffer.from(blurHashB64, 'base64')
  const avatarRes = await alice.uploadBlob(avatarImg, {
    encoding: 'image/png',
  })
  const fgAliceRes = await alice.create(
    app.bsky.feed.generator,
    {
      did: fg1.did,
      displayName: 'alices feed',
      description: 'all my fav stuff',
      avatar: avatarRes.body.blob,
      createdAt: date.next().value,
    },
    { rkey: fg1Uri.rkey },
  )

  await alice.create(app.bsky.feed.post, {
    text: 'check out my algorithm!',
    embed: {
      $type: 'app.bsky.embed.record',
      record: fgAliceRes,
    },
    createdAt: date.next().value,
  })
  for (const user of [alice, bob, carla]) {
    await user.create(app.bsky.feed.like, {
      subject: fgAliceRes,
      createdAt: date.next().value,
    })
  }

  const fg2Uri = AtUri.make(
    bob.assertDid,
    'app.bsky.feed.generator',
    'bob-redux',
  )
  const fg2 = await env.createFeedGen({
    [fg2Uri.toString()]: async () => {
      const feed = posts
        .filter(() => rand(2) === 0)
        .map((post) => ({ post: post.uri as AtUriString }))
      return {
        encoding: 'application/json',
        body: {
          feed,
        },
      }
    },
  })
  const fgBobRes = await bob.create(
    app.bsky.feed.generator,
    {
      did: fg2.did,
      displayName: 'Bobby boy hot new algo',
      createdAt: date.next().value,
    },
    { rkey: fg2Uri.rkey },
  )

  await alice.create(app.bsky.feed.post, {
    text: `bobs feed is neat too`,
    embed: {
      $type: 'app.bsky.embed.record',
      record: fgBobRes,
    },
    createdAt: date.next().value,
  })

  const fg3Uri = AtUri.make(
    carla.assertDid,
    'app.bsky.feed.generator',
    'carla-intr-algo',
  )
  const fg3 = await env.createFeedGen({
    [fg3Uri.toString()]: async () => {
      const feed = posts
        .filter(() => rand(2) === 0)
        .map((post) => ({ post: post.uri as AtUriString }))
      return {
        encoding: 'application/json',
        body: {
          feed,
        },
      }
    },
  })
  const fgCarlaRes = await carla.create(
    app.bsky.feed.generator,
    {
      did: fg3.did,
      displayName: `Acceptin' Generator`,
      acceptsInteractions: true,
      createdAt: date.next().value,
    },
    { rkey: fg3Uri.rkey },
  )

  await alice.create(app.bsky.feed.post, {
    text: `carla accepts interactions on her feed`,
    embed: {
      $type: 'app.bsky.embed.record',
      record: fgCarlaRes,
    },
    createdAt: date.next().value,
  })

  // create labeler service
  {
    await labeler.create(app.bsky.labeler.service, {
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
    })
    await createLabel(env.bsky.db, {
      uri: alice.assertDid,
      cid: '',
      val: 'rude',
      src: labeler.assertDid,
    })
    await createLabel(env.bsky.db, {
      uri: `at://${alice.assertDid}/app.bsky.feed.generator/alice-favs`,
      cid: '',
      val: 'cool',
      src: labeler.assertDid,
    })
    await createLabel(env.bsky.db, {
      uri: bob.assertDid,
      cid: '',
      val: 'cool',
      src: labeler.assertDid,
    })
    await createLabel(env.bsky.db, {
      uri: carla.assertDid,
      cid: '',
      val: 'spam',
      src: labeler.assertDid,
    })
  }

  // Create lists and add people to the lists
  {
    const flowerLovers = await alice.create(app.bsky.graph.list, {
      name: 'Flower Lovers',
      purpose: 'app.bsky.graph.defs#curatelist',
      createdAt: currentDatetimeString(),
      description: 'A list of posts about flowers',
    })
    const labelHaters = await bob.create(app.bsky.graph.list, {
      name: 'Label Haters',
      purpose: 'app.bsky.graph.defs#modlist',
      createdAt: currentDatetimeString(),
      description: 'A list of people who hate labels',
    })
    await alice.create(app.bsky.graph.listitem, {
      subject: bob.assertDid,
      createdAt: currentDatetimeString(),
      list: new RecordRef(flowerLovers.uri, flowerLovers.cid).uriStr,
    })
    await bob.create(app.bsky.graph.listitem, {
      subject: alice.assertDid,
      createdAt: currentDatetimeString(),
      list: new RecordRef(labelHaters.uri, labelHaters.cid).uriStr,
    })
  }

  await setVerifier(env.bsky.db, alice.assertDid)

  // @TODO These are useful when testing complex threads, but don't need to be enabled all the time. We could make it configurable.
  // import * as seedThreadV2 from '../seed/thread-v2.js'
  // const sc = env.getSeedClient()
  // await seedThreadV2.simple(sc)
  // await seedThreadV2.long(sc)
  // await seedThreadV2.deep(sc)
  // await seedThreadV2.branchingFactor(sc)
  // await seedThreadV2.annotateMoreReplies(sc)
  // await seedThreadV2.annotateOP(sc)
  // await seedThreadV2.sort(sc)
  // await seedThreadV2.bumpOpAndViewer(sc)
  // await seedThreadV2.bumpGroupSorting(sc)
  // await seedThreadV2.bumpFollows(sc)
  // await seedThreadV2.blockDeletionAuth(sc, env.bsky.ctx.cfg.modServiceDid)
  // await seedThreadV2.mutes(sc)
  // await seedThreadV2.threadgated(sc)
  // await seedThreadV2.tags(sc)
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

const setVerifier = async (db: Database, did: DidString) => {
  await db.db
    .updateTable('actor')
    .set({ trustedVerifier: true })
    .where('did', '=', did)
    .execute()
}
