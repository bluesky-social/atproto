import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await sc.createAccount('alice', users.alice)
  await sc.createAccount('bob', users.bob)
  await sc.createAccount('carol', users.carol)
  await sc.createAccount('dan', users.dan)
  await sc.createAccount('eve', users.eve)
  // This user should be set as a verifier via DB in the test,
  // so the vouches they gave are considered verifications.
  await sc.createAccount('verifier', users.verifier)
  for (const name in sc.dids) {
    await sc.createProfile(sc.dids[name], `display-${name}`, `descript-${name}`)
  }

  // Alice vouches.
  await sc.vouch(
    sc.dids.alice,
    sc.dids.bob,
    sc.accounts[sc.dids.bob].handle,
    sc.profiles[sc.dids.bob].displayName,
  )
  await sc.vouch(
    sc.dids.alice,
    sc.dids.carol,
    sc.accounts[sc.dids.carol].handle,
    sc.profiles[sc.dids.carol].displayName,
  )
  await sc.vouch(
    sc.dids.alice,
    sc.dids.dan,
    sc.accounts[sc.dids.dan].handle,
    sc.profiles[sc.dids.dan].displayName,
  )
  await sc.vouch(
    sc.dids.alice,
    sc.dids.eve,
    sc.accounts[sc.dids.eve].handle,
    sc.profiles[sc.dids.eve].displayName,
  )

  // Alice vouchers.
  await sc.vouch(
    sc.dids.bob,
    sc.dids.alice,
    sc.accounts[sc.dids.alice].handle,
    sc.profiles[sc.dids.alice].displayName,
  )
  await sc.vouch(
    sc.dids.carol,
    sc.dids.alice,
    sc.accounts[sc.dids.alice].handle,
    sc.profiles[sc.dids.alice].displayName,
  )

  // Bob's known vouchers from Alice viewer.
  await sc.vouch(
    sc.dids.carol,
    sc.dids.bob,
    sc.accounts[sc.dids.bob].handle,
    sc.profiles[sc.dids.bob].displayName,
  )
  await sc.vouch(
    sc.dids.eve,
    sc.dids.bob,
    sc.accounts[sc.dids.bob].handle,
    sc.profiles[sc.dids.bob].displayName,
  )

  // Verifier vouches.
  await sc.vouch(
    sc.dids.verifier,
    sc.dids.carol,
    sc.accounts[sc.dids.carol].handle,
    sc.profiles[sc.dids.carol].displayName,
  )
  await sc.vouch(
    sc.dids.verifier,
    sc.dids.dan,
    sc.accounts[sc.dids.dan].handle,
    sc.profiles[sc.dids.dan].displayName,
  )
  // @NOTE: for eve, the display name was changed, so this vouch should not be valid.
  await sc.vouch(
    sc.dids.verifier,
    sc.dids.eve,
    sc.accounts[sc.dids.eve].handle,
    'eve-original-name', // Assume this was eve's original name when the vouch happened, and it was changed after the vouch.
  )

  return sc
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
  verifier: {
    email: 'verifier@test.com',
    handle: 'verifier.test',
    password: 'verifier-pass',
  },
}
