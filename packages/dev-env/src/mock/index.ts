import { DevEnv } from '../index'
import { ServerType } from '../types'
import { genServerCfg } from '../util'
import { AdxUri } from '@adxp/uri'
import { ServiceClient } from '@adxp/api'
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
  await env.add(await genServerCfg(ServerType.DidPlaceholder))
  while (env.listOfType(ServerType.PersonalDataServer).length < numNeeded) {
    await env.add(await genServerCfg(ServerType.PersonalDataServer))
  }
}

export async function generateMockSetup(env: DevEnv) {
  const date = dateGen()
  await createNeededServers(env)

  const rand = (n: number) => Math.floor(Math.random() * n)
  const picka = <T>(arr: Array<T>): T => {
    if (arr.length) {
      return arr[rand(arr.length)] || arr[0]
    }
    throw new Error('Not found')
  }

  const clients = {
    loggedout: env.listOfType(ServerType.PersonalDataServer)[0].getClient(),
    alice: env.listOfType(ServerType.PersonalDataServer)[0].getClient(),
    bob: env.listOfType(ServerType.PersonalDataServer)[0].getClient(),
    carla: env.listOfType(ServerType.PersonalDataServer)[0].getClient(),
  }
  interface User {
    email: string
    did: string
    username: string
    password: string
    api: ServiceClient
  }
  const users: User[] = [
    {
      email: 'alice@test.com',
      did: '',
      username: `alice.test`,
      password: 'hunter2',
      api: clients.alice,
    },
    {
      email: 'bob@test.com',
      did: '',
      username: `bob.test`,
      password: 'hunter2',
      api: clients.bob,
    },
    {
      email: 'carla@test.com',
      did: '',
      username: `carla.test`,
      password: 'hunter2',
      api: clients.carla,
    },
  ]
  const alice = users[0]
  const bob = users[1]
  const carla = users[2]

  let _i = 1
  for (const user of users) {
    const res = await clients.loggedout.todo.adx.createAccount(
      {},
      { email: user.email, username: user.username, password: user.password },
    )
    user.did = res.data.did
    user.api.setHeader('Authorization', `Bearer ${res.data.jwt}`)
    await user.api.todo.social.profile.create(
      { did: user.did },
      {
        displayName: ucfirst(user.username).slice(0, -5),
        description: `Test user ${_i++}`,
      },
    )
  }

  // everybody follows everybody
  const follow = async (author: User, subject: string) => {
    await author.api.todo.social.follow.create(
      { did: author.did },
      {
        subject,
        createdAt: date.next().value,
      },
    )
  }
  await follow(alice, bob.did)
  await follow(alice, carla.did)
  await follow(bob, alice.did)
  await follow(bob, carla.did)
  await follow(carla, alice.did)
  await follow(carla, bob.did)

  // a set of posts and reposts
  const posts: { uri: string }[] = []
  for (let i = 0; i < postTexts.length; i++) {
    const author = picka(users)
    posts.push(
      await author.api.todo.social.post.create(
        { did: author.did },
        {
          text: postTexts[i],
          createdAt: date.next().value,
        },
      ),
    )
    if (rand(10) === 0) {
      const reposter = picka(users)
      await reposter.api.todo.social.repost.create(
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
    const target = await alice.api.todo.social.post.get({
      nameOrDid: urip.host,
      tid: urip.recordKey,
    })
    const author = picka(users)
    posts.push(
      await author.api.todo.social.post.create(
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
        await user.api.todo.social.like.create(
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
