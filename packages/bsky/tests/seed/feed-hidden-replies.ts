import { TestNetwork, SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'

export type User = {
  id: string
  did: string
  email: string
  handle: string
  password: string
  displayName: string
  description: string
  selfLabels: undefined
}

function createUser(name: string): User {
  return {
    id: name,
    // @ts-ignore overwritten below
    did: undefined,
    email: `${name}@test.com`,
    handle: `${name}.test`,
    password: `${name}-pass`,
    displayName: name,
    description: `hi im ${name} label_me`,
    selfLabels: undefined,
  }
}

const users = {
  viewer: createUser('viewer'),

  poster: createUser('poster'),
  replier: createUser('replier'),
  reposter: createUser('reposter'),
}

export type Users = typeof users

export async function feedHiddenRepliesSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  await sc.createAccount('poster', users.poster)
  await sc.createAccount('replier', users.replier)
  await sc.createAccount('viewer', users.viewer)
  await sc.createAccount('reposter', users.reposter)

  Object.values(users).forEach((user) => {
    users[user.id].did = sc.dids[user.id]
  })

  sc.follow(users.viewer.did, users.poster.did)
  sc.follow(users.viewer.did, users.replier.did)
  sc.follow(users.viewer.did, users.reposter.did)

  await sc.network.processAll()

  return {
    users,
    seedClient: sc,
  }
}
