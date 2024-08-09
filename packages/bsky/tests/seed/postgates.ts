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

  quotee: createUser('quotee'),
  quoter: createUser('quoter'),
}

export type Users = typeof users

export async function postgatesSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  await sc.createAccount('quotee', users.quotee)
  await sc.createAccount('quoter', users.quoter)
  await sc.createAccount('viewer', users.viewer)

  Object.values(users).forEach((user) => {
    users[user.id].did = sc.dids[user.id]
  })

  await sc.network.processAll()

  return {
    users,
    seedClient: sc,
  }
}
