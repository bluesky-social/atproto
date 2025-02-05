import { SeedClient, TestNetwork, TestNetworkNoAppView } from '@atproto/dev-env'

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
  const u = structuredClone(users)

  await sc.createAccount('poster', u.poster)
  await sc.createAccount('replier', u.replier)
  await sc.createAccount('viewer', u.viewer)
  await sc.createAccount('reposter', u.reposter)

  Object.values(u).forEach((user) => {
    u[user.id].did = sc.dids[user.id]
  })

  await sc.follow(u.viewer.did, u.poster.did)
  await sc.follow(u.viewer.did, u.replier.did)
  await sc.follow(u.viewer.did, u.reposter.did)

  await sc.network.processAll()

  return {
    users: u,
    seedClient: sc,
  }
}
