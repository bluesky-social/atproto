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
  trender: createUser('trender'),

  posterA: createUser('posterA'),
  posterB: createUser('posterB'),
  posterC: createUser('posterC'),
  posterD: createUser('posterD'),

  viewer: createUser('viewer'),
  viewerBlocker: createUser('viewerBlocker'),
}

export type Users = typeof users
export type Feeds = SeedClient['feedgens']

export async function trendsSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const u = structuredClone(users)

  await sc.createAccount('trender', u.trender)
  await sc.createAccount('posterA', u.posterA)
  await sc.createAccount('posterB', u.posterB)
  await sc.createAccount('posterC', u.posterC)
  await sc.createAccount('posterD', u.posterD)
  await sc.createAccount('viewer', u.viewer)
  await sc.createAccount('viewerBlocker', u.viewerBlocker)

  Object.values(u).forEach((user) => {
    u[user.id].did = sc.dids[user.id]
  })

  await sc.createFeedGen(u.trender.did, 'did:web:example.com', 'trendA')
  await sc.block(u.viewerBlocker.did, u.posterC.did)

  await sc.network.processAll()

  return {
    users: u,
    feeds: sc.feedgens,
    seedClient: sc,
  }
}
