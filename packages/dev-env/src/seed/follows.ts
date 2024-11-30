import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await sc.createAccount('alice', users.alice)
  await sc.createAccount('bob', users.bob)
  await sc.createAccount('carol', users.carol)
  await sc.createAccount('dan', users.dan)
  await sc.createAccount('eve', users.eve)
  for (const name in sc.dids) {
    await sc.createProfile(sc.dids[name], `display-${name}`, `descript-${name}`)
  }
  const alice = sc.dids.alice
  const bob = sc.dids.bob
  const carol = sc.dids.carol
  const dan = sc.dids.dan
  const eve = sc.dids.eve
  await sc.follow(alice, bob)
  await sc.follow(alice, carol)
  await sc.follow(alice, dan)
  await sc.follow(alice, eve)
  await sc.follow(carol, alice)
  await sc.follow(bob, alice)
  await sc.follow(bob, carol)
  await sc.follow(dan, alice)
  await sc.follow(dan, bob)
  await sc.follow(dan, eve)
  await sc.follow(eve, alice)
  await sc.follow(eve, carol)
}

const users = {
  alice: {
    email: 'alice@test.com',
    handle: 'alice.test',
    password: 'alice-pass',
  },
  bob: {
    email: 'bob@test.com',
    handle: 'bob.test',
    password: 'bob-pass',
  },
  carol: {
    email: 'carol@test.com',
    handle: 'carol.test',
    password: 'carol-pass',
  },
  dan: {
    email: 'dan@test.com',
    handle: 'dan.test',
    password: 'dan-pass',
  },
  eve: {
    email: 'eve@test.com',
    handle: 'eve.test',
    password: 'eve-pass',
  },
}
