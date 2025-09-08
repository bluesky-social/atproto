import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await sc.createAccount('alice', users.alice)
  await sc.createAccount('bob', users.bob)
  await sc.createAccount('carol', users.carol)
  await sc.createAccount('dan', users.dan)
  await sc.createAccount('eve', users.eve)
  await sc.createAccount('frank', users.frank)
  await sc.createAccount('gus', users.gus)

  // This user should be set a label 'impersonation` in the tests.
  await sc.createAccount('impersonator', users.impersonator)

  await sc.createAccount('nonverifier', users.nonverifier)

  // These users should be set as verifiers via DB in the test,
  // so their verifications are trusted by the app.
  await sc.createAccount('verifier1', users.verifier1)
  await sc.createAccount('verifier2', users.verifier2)
  // This user should be set a label 'impersonation` in the tests.
  await sc.createAccount('verifier3', users.verifier3)

  for (const name in sc.dids) {
    await sc.createProfile(sc.dids[name], `display-${name}`, `descript-${name}`)
  }

  // alice: the viewer, has no verifications at all.
  // NOOP

  // bob: has verifications by multiple verifiers.
  await sc.verify(
    sc.dids.verifier1,
    sc.dids.bob,
    sc.accounts[sc.dids.bob].handle,
    sc.profiles[sc.dids.bob].displayName,
  )
  await sc.verify(
    sc.dids.verifier2,
    sc.dids.bob,
    sc.accounts[sc.dids.bob].handle,
    sc.profiles[sc.dids.bob].displayName,
  )

  // carol: has non-broken and broken verifications by verifiers.
  await sc.verify(
    sc.dids.verifier1,
    sc.dids.carol,
    sc.accounts[sc.dids.carol].handle,
    sc.profiles[sc.dids.carol].displayName,
  )
  await sc.verify(
    sc.dids.verifier2,
    sc.dids.carol,
    'carol.old.handle', // Broken: this was the handle during verification and it changed later.
    sc.profiles[sc.dids.carol].displayName,
  )

  // dan: has verifications by verifiers and non verifiers.
  await sc.verify(
    sc.dids.verifier1,
    sc.dids.dan,
    sc.accounts[sc.dids.dan].handle,
    sc.profiles[sc.dids.dan].displayName,
  )
  await sc.verify(
    sc.dids.nonverifier,
    sc.dids.dan,
    sc.accounts[sc.dids.dan].handle,
    sc.profiles[sc.dids.dan].displayName,
  )

  // eve: has no verifications at all.
  // NOOP

  // frank: has only broken verifications by verifiers.
  await sc.verify(
    sc.dids.verifier2,
    sc.dids.frank,
    sc.accounts[sc.dids.frank].handle,
    'frank-old-name', // Broken: this was the name during verification and it changed later.
  )

  // gus: has only verifications by non verifiers.
  await sc.verify(
    sc.dids.nonverifier,
    sc.dids.gus,
    sc.accounts[sc.dids.gus].handle,
    sc.profiles[sc.dids.gus].displayName,
  )

  // impersonator: has verification by verifier but should get the impersonator label during tests.
  await sc.verify(
    sc.dids.verifier1,
    sc.dids.impersonator,
    sc.accounts[sc.dids.impersonator].handle,
    sc.profiles[sc.dids.impersonator].displayName,
  )

  // verifier1: is verifier and has verification by other verifier. Should show as a verifier, not just as verified.
  await sc.verify(
    sc.dids.verifier2,
    sc.dids.verifier1,
    sc.accounts[sc.dids.verifier1].handle,
    sc.profiles[sc.dids.verifier1].displayName,
  )

  // verifier2: is verifier and has no verification by other verifier.
  // NOOP

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
  frank: {
    email: 'frank@test.com',
    handle: 'frank.test',
    password: 'frank-pass',
  },
  gus: {
    email: 'gus@test.com',
    handle: 'gus.test',
    password: 'gus-pass',
  },
  impersonator: {
    email: 'impersonator@test.com',
    handle: 'impersonator.test',
    password: 'impersonator-pass',
  },
  verifier1: {
    email: 'verifier1@test.com',
    handle: 'verifier1.test',
    password: 'verifier1-pass',
  },
  verifier2: {
    email: 'verifier2@test.com',
    handle: 'verifier2.test',
    password: 'verifier2-pass',
  },
  verifier3: {
    email: 'verifier3@test.com',
    handle: 'verifier3.test',
    password: 'verifier3-pass',
  },
  nonverifier: {
    email: 'nonverifier@test.com',
    handle: 'nonverifier.test',
    password: 'nonverifier-pass',
  },
}
