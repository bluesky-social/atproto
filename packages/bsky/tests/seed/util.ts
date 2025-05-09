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

function createUserStub(name: string): User {
  return {
    id: name,
    // @ts-ignore overwritten during seeding
    did: undefined,
    email: `${name}@test.com`,
    handle: `${name}.test`,
    password: `${name}-pass`,
    displayName: name,
    description: `hi im ${name} label_me`,
    selfLabels: undefined,
  }
}

export async function createUsers<T extends readonly string[]>(
  seedClient: SeedClient<TestNetwork | TestNetworkNoAppView>,
  prefix: string,
  handles: T,
) {
  const stubs = handles.reduce((acc, handle) => {
    acc[handle] = createUserStub(`${prefix}-${handle}`)
    return acc
  }, {}) as Record<(typeof handles)[number], User>
  const users = await Promise.all(
    handles
      .map((h) => prefix + '-' + h)
      .map(async (handle) => {
        const user = createUserStub(handle)
        await seedClient.createAccount(handle, user)
        user.did = seedClient.dids[handle]
        return user
      }),
  )
  return users.reduce((acc, user) => {
    const id = user.id.split('-')[1]
    acc[id].did = user.did
    return acc
  }, stubs)
}
