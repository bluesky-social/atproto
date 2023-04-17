import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await sc.createAccount('alice', users.alice)
  await sc.createAccount('bob', users.bob)
  await sc.createAccount('carol', users.carol)
  await sc.createAccount('dan', users.dan)

  await sc.createProfile(
    sc.dids.alice,
    users.alice.displayName,
    users.alice.description,
  )
  await sc.createProfile(
    sc.dids.bob,
    users.bob.displayName,
    users.bob.description,
  )

  return sc
}

const users = {
  alice: {
    email: 'alice@test.com',
    handle: 'alice.test',
    password: 'alice-pass',
    displayName: 'ali',
    description: 'its me!',
  },
  bob: {
    email: 'bob@test.com',
    handle: 'bob.test',
    password: 'bob-pass',
    displayName: 'bobby',
    description: 'hi im bob label_me',
  },
  carol: {
    email: 'carol@test.com',
    handle: 'carol.test',
    password: 'carol-pass',
    displayName: undefined,
    description: undefined,
  },
  dan: {
    email: 'dan@test.com',
    handle: 'dan.test',
    password: 'dan-pass',
    displayName: undefined,
    description: undefined,
  },
}
