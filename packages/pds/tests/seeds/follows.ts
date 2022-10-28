import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await sc.createAccount('alice', users.alice)
  await sc.createAccount('bob', users.bob)
  await sc.createAccount('carol', users.carol)
  await sc.createAccount('dan', users.dan)
  await sc.createAccount('eve', users.eve)
  await sc.follow(sc.dids.alice, sc.dids.bob)
  await sc.follow(sc.dids.alice, sc.dids.carol)
  await sc.follow(sc.dids.alice, sc.dids.dan)
  await sc.follow(sc.dids.alice, sc.dids.eve)
  await sc.follow(sc.dids.carol, sc.dids.alice)
  await sc.follow(sc.dids.bob, sc.dids.alice)
  await sc.follow(sc.dids.bob, sc.dids.carol)
  await sc.follow(sc.dids.dan, sc.dids.alice)
  await sc.follow(sc.dids.dan, sc.dids.bob)
  await sc.follow(sc.dids.dan, sc.dids.eve)
  await sc.follow(sc.dids.eve, sc.dids.alice)
  await sc.follow(sc.dids.eve, sc.dids.carol)
}

const users = {
  alice: {
    email: 'alice@test.com',
    username: 'alice.test',
    password: 'alice-pass',
  },
  bob: {
    email: 'bob@test.com',
    username: 'bob.test',
    password: 'bob-pass',
  },
  carol: {
    email: 'carol@test.com',
    username: 'carol.test',
    password: 'carol-pass',
  },
  dan: {
    email: 'dan@test.com',
    username: 'dan.test',
    password: 'dan-pass',
  },
  eve: {
    email: 'eve@test.com',
    username: 'eve.test',
    password: 'eve-pass',
  },
}
