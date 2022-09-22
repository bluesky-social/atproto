import { DevEnv } from '../index'
import { ServerType } from '../types'
import { genServerCfg } from '../util'
import { AdxUri } from '@adxp/common'
import { postTexts, replyTexts } from './data'

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

async function createNeededServers(env: DevEnv, numNeeded = 1) {
  while (env.listOfType(ServerType.PersonalDataServer).length < numNeeded) {
    await env.add(await genServerCfg(ServerType.PersonalDataServer))
  }
}

export async function generateMockSetup(env: DevEnv) {
  const date = dateGen()
  await createNeededServers(env)

  const client = env.listOfType(ServerType.PersonalDataServer)[0].getClient()

  const rand = (n: number) => Math.floor(Math.random() * n)
  const picka = <T>(arr: Array<T>): T => {
    if (arr.length) {
      return arr[rand(arr.length)] || arr[0]
    }
    throw new Error('Not found')
  }

  const users = [
    { did: `did:test:alice`, username: `alice.test` },
    { did: `did:test:bob`, username: `bob.test` },
    { did: `did:test:carla`, username: `carla.test` },
  ]

  let _i = 1
  for (const user of users) {
    await client.todo.adx.createAccount({}, user)
    await client.todo.social.profile.create(
      { did: user.did },
      {
        displayName: ucfirst(user.username),
        description: `Test user ${_i++}`,
      },
    )
  }

  // everybody follows everybody
  const follow = async (author: string, subject: string) => {
    await client.todo.social.follow.create(
      { did: author },
      {
        subject,
        createdAt: date.next().value,
      },
    )
  }
  await follow('did:test:alice', 'did:test:bob')
  await follow('did:test:alice', 'did:test:carla')
  await follow('did:test:bob', 'did:test:alice')
  await follow('did:test:bob', 'did:test:carla')
  await follow('did:test:carla', 'did:test:alice')
  await follow('did:test:carla', 'did:test:bob')

  // a set of posts and reposts
  const posts: { uri: string }[] = []
  for (let i = 0; i < postTexts.length; i++) {
    const author = picka(users)
    posts.push(
      await client.todo.social.post.create(
        { did: author.did },
        {
          text: postTexts[i],
          createdAt: date.next().value,
        },
      ),
    )
    if (rand(10) === 0) {
      let reposter = picka(users)
      await client.todo.social.repost.create(
        { did: reposter.did },
        {
          subject: picka(posts).uri,
          createdAt: date.next().value,
        },
      )
    }
  }

  // a set of replies
  for (let i = 0; i < 100; i++) {
    const targetUri = picka(posts).uri
    const urip = new AdxUri(targetUri)
    const target = await client.todo.social.post.get({
      nameOrDid: urip.host,
      tid: urip.recordKey,
    })
    const author = picka(users)
    posts.push(
      await client.todo.social.post.create(
        { did: author.did },
        {
          text: picka(replyTexts),
          reply: {
            root: target.value.reply ? target.value.reply.root : target.uri,
            parent: target.uri,
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
        await client.todo.social.like.create(
          { did: user.did },
          {
            subject: post.uri,
            createdAt: date.next().value,
          },
        )
      }
    }
  }
}

function ucfirst(str: string): string {
  return str.at(0)?.toUpperCase() + str.slice(1)
}
