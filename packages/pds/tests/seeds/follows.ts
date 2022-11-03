import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await sc.createAccount('alice', users.alice)
  await sc.createAccount('bob', users.bob)
  await sc.createAccount('carol', users.carol)
  await sc.createAccount('dan', users.dan)
  await sc.createAccount('eve', users.eve)
  const alice = sc.dids.alice
  const bob = sc.dids.bob
  const carol = sc.dids.carol
  const dan = sc.dids.dan
  const eve = sc.dids.eve
  await sc.follow(alice, sc.userRef(bob))
  await sc.follow(alice, sc.userRef(carol))
  await sc.follow(alice, sc.userRef(dan))
  await sc.follow(alice, sc.userRef(eve))
  await sc.follow(carol, sc.userRef(alice))
  await sc.follow(bob, sc.userRef(alice))
  await sc.follow(bob, sc.userRef(carol))
  await sc.follow(dan, sc.userRef(alice))
  await sc.follow(dan, sc.userRef(bob))
  await sc.follow(dan, sc.userRef(eve))
  await sc.follow(eve, sc.userRef(alice))
  await sc.follow(eve, sc.userRef(carol))
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
