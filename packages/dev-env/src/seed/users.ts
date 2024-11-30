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
    users.alice.selfLabels,
  )
  await sc.createProfile(
    sc.dids.bob,
    users.bob.displayName,
    users.bob.description,
    users.bob.selfLabels,
  )

  await sc.agent.api.chat.bsky.actor.declaration.create(
    { repo: sc.dids.dan },
    { allowIncoming: 'none' },
    sc.getHeaders(sc.dids.dan),
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
    selfLabels: ['self-label-a', 'self-label-b'],
  },
  bob: {
    email: 'bob@test.com',
    handle: 'bob.test',
    password: 'bob-pass',
    displayName: 'bobby',
    description: 'hi im bob label_me',
    selfLabels: undefined,
  },
  carol: {
    email: 'carol@test.com',
    handle: 'carol.test',
    password: 'carol-pass',
    displayName: undefined,
    description: undefined,
    selfLabels: undefined,
  },
  dan: {
    email: 'dan@test.com',
    handle: 'dan.test',
    password: 'dan-pass',
    displayName: undefined,
    description: undefined,
    selfLabels: undefined,
  },
}
