import { SeedClient } from '@atproto/dev-env'

export default async (sc: SeedClient, opts?: { inviteCode?: string }) => {
  await sc.createAccount('alice', {
    ...users.alice,
    inviteCode: opts?.inviteCode,
  })
  await sc.createAccount('bob', { ...users.bob, inviteCode: opts?.inviteCode })
  await sc.createAccount('carol', {
    ...users.carol,
    inviteCode: opts?.inviteCode,
  })
  await sc.createAccount('dan', { ...users.dan, inviteCode: opts?.inviteCode })

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

  return sc
}

export const users = {
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
