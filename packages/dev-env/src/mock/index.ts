import { AtUri } from '@atproto/syntax'
import AtpAgent from '@atproto/api'
import { Database } from '@atproto/bsky'
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
            'gore',
            'upsetting',
            'sensitive',
            'self-harm',
            'intolerant',
            'extremist',
            'rude',
            'threat',
            'harassment',
            'spam',
            'engagement-farming',
            'impersonation',
            'inauthentic',
            'scam',
            'security',
            'misleading',
            'misinformation',
            'unsafe-link',
            'illegal',
          ],
          labelValueDefinitions: [
            {
              identifier: 'spam',
              blurs: 'content',
              severity: 'info',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Spam',
                  description:
                    'Activity that is unsolicited, repetitive, or irrelevant, and intrusive to users. Inclusive of replies, mentions, follows, likes, and notifications that are used in a spammy manner.',
                },
              ],
            },
            {
              identifier: 'impersonation',
              blurs: 'none',
              severity: 'info',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Impersonation',
                  description:
                    'Attempting to deceive users by mimicking the identity of another person, brand, or entity without authorization. This includes using similar usernames, profile pictures, and posting content that falsely represents the impersonated party.',
                },
              ],
            },
            {
              identifier: 'scam',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Scam',
                  description:
                    'Engaging in deceptive practices aimed at defrauding or misleading users, such as fraudulent offers, phishing attempts, or false claims to solicit personal information or financial gain. This includes fake giveaways, investment scams, and counterfeit sales',
                },
              ],
            },
            {
              identifier: 'intolerant',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Intolerance',
                  description:
                    'Includes hateful, intolerant, or discriminatory views against individuals or groups based on gender, race, religion or other protected characteristics.',
                },
              ],
            },
            {
              identifier: 'self-harm',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Self-Harm',
                  description:
                    'Depicts or promotes self-injurious behavior, including cutting, self-mutilation, or suicide attempts. This includes graphic imagery, discussions that glorify or encourage self-harm, and potentially triggering narratives related to self-injury.',
                },
              ],
            },
            {
              identifier: 'security',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Security Concerns',
                  description:
                    "Potentially harmful to users' online safety, including malware distribution, phishing attempts, or signs of a compromised account. This encompasses links to possible malicious software, deceptive practices aimed at stealing personal information, and unusual account behavior indicating unauthorized access.",
                },
              ],
            },
            {
              identifier: 'misleading',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Misleading',
                  description:
                    'Presents false information that misleads users, including manipulated media, text hacks, link misdirects, fake websites, or fraudulent claims. ',
                },
              ],
            },
            {
              identifier: 'threat',
              blurs: 'content',
              severity: 'info',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Threats',
                  description:
                    'Intentions of violence or harm towards individuals or groups, including direct threats, incitement of violence, or advocating for physical or psychological harm. This includes specific threats of violence, encouragement of dangerous activities, and any communication intended to intimidate or coerce',
                },
              ],
            },
            {
              identifier: 'unsafe-link',
              blurs: '',
              severity: '',
              defaultSetting: '',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Unsafe link',
                  description:
                    'URLs that may lead to harmful websites, including those hosting malware, phishing schemes, or content that violates community guidelines. This includes links that may compromise user security, privacy, or expose them to deceptive or inappropriate content.',
                },
              ],
            },
            {
              identifier: 'illegal',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Illegal',
                  description:
                    'Promotion, sale, or facilitation of goods, services, or activities that violate laws, including but not limited to unauthorized drugs, weapons sales, human trafficking, or promoting dangerous illegal acts. This encompasses any content that encourages or aids in the commission of unlawful behavior',
                },
              ],
            },
            {
              identifier: 'misinformation',
              blurs: 'content',
              severity: 'info',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Misinformation',
                  description:
                    'Inaccurate or misleading, including unverified claims, facts that have been proven false, and conspiracy theories without credible support. This includes information that could lead to public confusion, health risks, or undermine public trust on important matters, such as elections. ',
                },
              ],
            },
            {
              identifier: 'rude',
              blurs: 'content',
              severity: 'info',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Rude',
                  description:
                    'May not violate specific community standards but is characterized by discourtesy or impoliteness, including crude language, disrespectful comments, or aggressive tones. This includes interactions that are unnecessarily harsh, confrontational, or lacking in constructive purpose.',
                },
              ],
            },
            {
              identifier: 'extremist',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Extremist',
                  description:
                    'Promotion, support, or advocacy of radical ideologies that advocate for violence, hate, or discrimination against individuals or groups.',
                },
              ],
            },
            {
              identifier: 'harassment',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Harassment',
                  description:
                    'Targeted, aggressive behavior intended to intimidate, bully, or demean individuals or groups. This includes persistent unwanted contact, threats, derogatory comments, and the sharing of personal information without consent.',
                },
              ],
            },
            {
              identifier: 'sensitive',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Sensitive',
                  description:
                    'Could be distressing or triggering to some users, including depictions or discussions of substance abuse, eating disorders, and other mental health issues. It aims to caution viewers about potentially difficult subjects that may affect their well-being or evoke strong emotional responses.',
                },
              ],
            },
            {
              identifier: 'engagement-farming',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Engagement Farming',
                  description:
                    'Pattern of content and/or bulk interactions which seems insincere and with the purpose of building a large following. Inclusive of follow, post, mention and like behaviours, along with accounts that churn these activities to gain attention or disrupt the user experience.  ',
                },
              ],
            },
            {
              identifier: 'inauthentic',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'hide',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Inauthentic Account',
                  description:
                    'Account is not what it appears. Might be a bot pretending to be a human, or a human misleadingly pretending to be a different demographic or identity group.',
                },
              ],
            },
            {
              identifier: 'upsetting',
              blurs: 'content',
              severity: 'warn',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Upsetting',
                  description:
                    'Could cause cause emotional distress or discomfort to viewers. This includes intense emotional confrontations, discussions of traumatic events, or any material that could be considered distressing or deeply troubling.',
                },
              ],
            },
            {
              identifier: 'sexual-figurative',
              blurs: 'media',
              severity: 'none',
              defaultSetting: 'ignore',
              adultOnly: true,
              locales: [
                {
                  lang: 'en',
                  name: 'Sexually Suggestive (Cartoon)',
                  description:
                    'Drawn, painted or digital art that is explicitly sexual or employs suggestive elements to evoke sexual themes, through provocative posts, partially concealed nudity to suggest sexual content. ',
                },
              ],
            },
            {
              identifier: 'gore',
              blurs: 'media',
              severity: 'warn',
              defaultSetting: 'warn',
              adultOnly: false,
              locales: [
                {
                  lang: 'en',
                  name: 'Graphic Imagery (Gore)',
                  description:
                    'Graphically depicts violence, injuries, or bodily harm, which may be shocking or disturbing to viewers. This includes scenes of accidents, surgical procedures, or explicit violence in both real-life and fictional contexts.',
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
      src: opts.src ?? 'did:example:labeler',
    })
    .execute()
}
