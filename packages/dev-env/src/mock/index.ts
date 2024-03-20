import { AtUri } from '@atproto/syntax'
import AtpAgent, { COM_ATPROTO_MODERATION } from '@atproto/api'
import { Database } from '@atproto/bsky'
import { EXAMPLE_LABELER, TestNetwork } from '../index'
import { postTexts, replyTexts } from './data'
import labeledImgB64 from './img/labeled-img-b64'
import blurHashB64 from './img/blur-hash-avatar-b64'

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

  // Create moderator accounts
  const triageRes =
    await clients.loggedout.api.com.atproto.server.createAccount({
      email: 'triage@test.com',
      handle: 'triage.test',
      password: 'triage-pass',
    })
  env.ozone.addAdminDid(triageRes.data.did)
  const modRes = await clients.loggedout.api.com.atproto.server.createAccount({
    email: 'mod@test.com',
    handle: 'mod.test',
    password: 'mod-pass',
  })
  env.ozone.addAdminDid(modRes.data.did)
  const adminRes = await clients.loggedout.api.com.atproto.server.createAccount(
    {
      email: 'admin-mod@test.com',
      handle: 'admin-mod.test',
      password: 'admin-mod-pass',
    },
  )
  env.ozone.addAdminDid(adminRes.data.did)

  // Report one user
  const reporter = picka(users)
  await reporter.agent.api.com.atproto.moderation.createReport({
    reasonType: picka([
      COM_ATPROTO_MODERATION.DefsReasonSpam,
      COM_ATPROTO_MODERATION.DefsReasonOther,
    ]),
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

  // create the dev-env moderator
  {
    const res = await clients.loggedout.api.com.atproto.server.createAccount({
      email: 'mod-authority@test.com',
      handle: 'mod-authority.test',
      password: 'hunter2',
    })
    const agent = env.pds.getClient()
    agent.api.setHeader('Authorization', `Bearer ${res.data.accessJwt}`)
    await agent.api.app.bsky.actor.profile.create(
      { repo: res.data.did },
      {
        displayName: 'Dev-env Moderation',
        description: `The pretend version of mod.bsky.app`,
      },
    )

    await agent.api.app.bsky.labeler.service.create(
      { repo: res.data.did, rkey: 'self' },
      {
        policies: {
          labelValues: [
            '!hide',
            '!warn',
            'porn',
            'sexual',
            'nudity',
            'sexual-figurative',
            'graphic-media',
            'self-harm',
            'sensitive',
            'extremist',
            'intolerant',
            'threat',
            'rude',
            'illicit',
            'security',
            'unsafe-link',
            'impersonation',
            'misinformation',
            'scam',
            'engagement-farming',
            'spam',
            'rumor',
            'misleading',
            'inauthentic',
          ],
          labelValueDefinitions: [
            {
              identifier: 'spam',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Spam',
                  description:
                    'Unwanted, repeated, or unrelated actions that bother users.',
                },
              ],
            },
            {
              identifier: 'impersonation',
              blurs: 'none',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Impersonation',
                  description:
                    'Pretending to be someone else without permission.',
                },
              ],
            },
            {
              identifier: 'scam',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Scam',
                  description: 'Scams, phishing & fraud.',
                },
              ],
            },
            {
              identifier: 'intolerant',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Intolerance',
                  description: 'Discrimination against protected groups.',
                },
              ],
            },
            {
              identifier: 'self-harm',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Self-Harm',
                  description:
                    'Promotes self-harm, including graphic images, glorifying discussions, or triggering stories.',
                },
              ],
            },
            {
              identifier: 'security',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Security Concerns',
                  description:
                    'May be unsafe and could harm your device, steal your info, or get your account hacked.',
                },
              ],
            },
            {
              identifier: 'misleading',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Misleading',
                  description:
                    'Altered images/videos, deceptive links, or false statements.',
                },
              ],
            },
            {
              identifier: 'threat',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Threats',
                  description:
                    'Promotes violence or harm towards others, including threats, incitement, or advocacy of harm.',
                },
              ],
            },
            {
              identifier: 'unsafe-link',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Unsafe link',
                  description:
                    'Links to harmful sites with malware, phishing, or violating content that risk security and privacy.',
                },
              ],
            },
            {
              identifier: 'illicit',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Illicit',
                  description:
                    'Promoting or selling potentially illicit goods, services, or activities.',
                },
              ],
            },
            {
              identifier: 'misinformation',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Misinformation',
                  description:
                    'Spreading false or misleading info, including unverified claims and harmful conspiracy theories.',
                },
              ],
            },
            {
              identifier: 'rumor',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Rumor',
                  description:
                    'Approach with caution, as these claims lack evidence from credible sources.',
                },
              ],
            },
            {
              identifier: 'rude',
              blurs: 'content',
              severity: 'inform',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Rude',
                  description:
                    'Rude or impolite, including crude language and disrespectful comments, without constructive purpose.',
                },
              ],
            },
            {
              identifier: 'extremist',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Extremist',
                  description:
                    'Radical views advocating violence, hate, or discrimination against individuals or groups.',
                },
              ],
            },
            {
              identifier: 'sensitive',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Sensitive',
                  description:
                    'May be upsetting, covering topics like substance abuse or mental health issues, cautioning sensitive viewers.',
                },
              ],
            },
            {
              identifier: 'engagement-farming',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Engagement Farming',
                  description:
                    'Insincere content or bulk actions aimed at gaining followers, including frequent follows, posts, and likes.',
                },
              ],
            },
            {
              identifier: 'inauthentic',
              blurs: 'content',
              severity: 'alert',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Inauthentic Account',
                  description: 'Bot or a person pretending to be someone else.',
                },
              ],
            },
            {
              identifier: 'sexual-figurative',
              blurs: 'media',
              severity: 'none',
              defaultSetting: 'show',
              adultOnly: true,
              locales: [
                {
                  lang: 'en',
                  name: 'Sexually Suggestive (Cartoon)',
                  description:
                    'Art with explicit or suggestive sexual themes, including provocative imagery or partial nudity.',
                },
              ],
            },
          ],
        },
        createdAt: date.next().value,
      },
    )
  }

  // create a labeler account
  {
    const res = await clients.loggedout.api.com.atproto.server.createAccount({
      email: 'labeler@test.com',
      handle: 'labeler.test',
      password: 'hunter2',
    })
    const agent = env.pds.getClient()
    agent.api.setHeader('Authorization', `Bearer ${res.data.accessJwt}`)
    await agent.api.app.bsky.actor.profile.create(
      { repo: res.data.did },
      {
        displayName: 'Test Labeler',
        description: `Labeling things across the atmosphere`,
      },
    )

    await agent.api.app.bsky.labeler.service.create(
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
      uri: alice.did,
      cid: '',
      val: 'rude',
      src: res.data.did,
    })
    await createLabel(env.bsky.db, {
      uri: `at://${alice.did}/app.bsky.feed.generator/alice-favs`,
      cid: '',
      val: 'cool',
      src: res.data.did,
    })
    await createLabel(env.bsky.db, {
      uri: bob.did,
      cid: '',
      val: 'cool',
      src: res.data.did,
    })
    await createLabel(env.bsky.db, {
      uri: carla.did,
      cid: '',
      val: 'spam',
      src: res.data.did,
    })
  }
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
