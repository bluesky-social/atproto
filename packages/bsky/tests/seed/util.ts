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

export function createUserStub(name: string): User {
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
