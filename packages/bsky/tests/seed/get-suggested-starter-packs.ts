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
  creator: createUser('creator'),
  poster: createUser('poster'),

  viewer: createUser('viewer'),
  viewerBlocker: createUser('viewerBlocker'),
}

export type Users = typeof users
export type StarterPacks = SeedClient['starterpacks']

export async function starterPacksSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const u = structuredClone(users)

  await sc.createAccount('creator', u.creator)
  await sc.createAccount('poster', u.poster)
  await sc.createAccount('viewer', u.viewer)
  await sc.createAccount('viewerBlocker', u.viewerBlocker)

  Object.values(u).forEach((user) => {
    u[user.id].did = sc.dids[user.id]
  })

  await sc.createStarterPack(u.creator.did, 'test', [u.poster.did])
  await sc.block(u.viewerBlocker.did, u.creator.did)

  await sc.network.processAll()

  return {
    users: u,
    starterpacks: sc.starterpacks,
    seedClient: sc,
  }
}
