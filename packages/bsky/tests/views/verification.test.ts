import assert from 'node:assert'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, verificationsSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'
import { VerificationState } from '../../src/lexicon/types/app/bsky/actor/defs'

interface ProfileViewTestCase {
  description: string
  // The DIDs are only set during test setup, so data that depends on those DIDs
  // needs to be lazily evaluated by using a function.
  getDid: () => string
  getExpected: () => VerificationState | undefined
  getExpectedUrisPrefixes?: () => string[]
}

describe('verification views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let labelerDid: string
  let sc: SeedClient

  // account dids, for convenience
  let alice: string
  let bob: string
  let carol: string
  let dan: string
  let eve: string
  let frank: string
  let gus: string
  let impersonator: string
  let verifier1: string
  let verifier2: string
  let verifier3: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_views_verification',
    })
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await verificationsSeed(sc)

    labelerDid = network.bsky.ctx.cfg.modServiceDid
    await createLabel({
      src: labelerDid,
      uri: sc.dids.impersonator,
      cid: '',
      val: 'impersonation',
    })
    await createLabel({
      src: labelerDid,
      uri: sc.dids.verifier3,
      cid: '',
      val: 'impersonation',
    })

    await network.processAll()

    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    eve = sc.dids.eve
    frank = sc.dids.frank
    gus = sc.dids.gus
    impersonator = sc.dids.impersonator
    verifier1 = sc.dids.verifier1
    verifier2 = sc.dids.verifier2
    verifier3 = sc.dids.verifier3

    await network.bsky.db.db
      .updateTable('actor')
      .set({ trustedVerifier: true })
      .where('did', 'in', [verifier1, verifier2, verifier3])
      .execute()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('profile views', () => {
    const testCases: ProfileViewTestCase[] = [
      {
        description: 'returns trusted verifier that has verifications',
        getDid: () => verifier1,
        getExpected: () => ({
          verifications: [
            {
              createdAt: expect.any(String),
              isValid: true,
              issuer: verifier2,
              uri: expect.any(String),
            },
          ],
          verifiedStatus: 'valid',
          trustedVerifierStatus: 'valid',
        }),
        getExpectedUrisPrefixes: () => [
          `at://${verifier2}/app.bsky.graph.verification/`,
        ],
      },
      {
        description: 'returns trusted verifier that has no verifications',
        getDid: () => verifier2,
        getExpected: () => ({
          verifications: [],
          verifiedStatus: 'none',
          trustedVerifierStatus: 'valid',
        }),
      },
      {
        description: 'returns trusted verifier with impersonation',
        getDid: () => verifier3,
        getExpected: () => ({
          verifications: [],
          verifiedStatus: 'none',
          trustedVerifierStatus: 'invalid',
        }),
      },
      {
        description: 'returns verified with multiple verifications',
        getDid: () => bob,
        getExpected: () => ({
          verifications: [
            {
              createdAt: expect.any(String),
              isValid: true,
              issuer: verifier1,
              uri: expect.any(String),
            },
            {
              createdAt: expect.any(String),
              isValid: true,
              issuer: verifier2,
              uri: expect.any(String),
            },
          ],
          verifiedStatus: 'valid',
          trustedVerifierStatus: 'none',
        }),
        getExpectedUrisPrefixes: () => [
          `at://${verifier1}/app.bsky.graph.verification/`,
          `at://${verifier2}/app.bsky.graph.verification/`,
        ],
      },
      {
        description: 'returns verified with mixed valid/invalid verifications',
        getDid: () => carol,
        getExpected: () => ({
          verifications: [
            {
              createdAt: expect.any(String),
              isValid: true,
              issuer: verifier1,
              uri: expect.any(String),
            },
            {
              createdAt: expect.any(String),
              isValid: false,
              issuer: verifier2,
              uri: expect.any(String),
            },
          ],
          verifiedStatus: 'valid',
          trustedVerifierStatus: 'none',
        }),
        getExpectedUrisPrefixes: () => [
          `at://${verifier1}/app.bsky.graph.verification/`,
          `at://${verifier2}/app.bsky.graph.verification/`,
        ],
      },
      {
        description: 'returns verified excluding non-verifier verifications',
        getDid: () => dan,
        getExpected: () => ({
          verifications: [
            {
              createdAt: expect.any(String),
              isValid: true,
              issuer: verifier1,
              uri: expect.any(String),
            },
            // It has a verification by a non-verifier, which is not included.
          ],
          verifiedStatus: 'valid',
          trustedVerifierStatus: 'none',
        }),
        getExpectedUrisPrefixes: () => [
          `at://${verifier1}/app.bsky.graph.verification/`,
        ],
      },
      {
        description: 'returns undefined for user with no verifications at all',
        getDid: () => eve,
        getExpected: () => undefined,
      },
      {
        description:
          'returns unverified with only invalid verifications from verifiers',
        getDid: () => frank,
        getExpected: () => ({
          verifications: [
            {
              createdAt: expect.any(String),
              isValid: false,
              issuer: verifier2,
              uri: expect.any(String),
            },
          ],
          verifiedStatus: 'invalid',
          trustedVerifierStatus: 'none',
        }),
        getExpectedUrisPrefixes: () => [
          `at://${verifier2}/app.bsky.graph.verification/`,
        ],
      },
      {
        description:
          'returns unverified for user with only verifications by non-verifiers',
        getDid: () => gus,
        getExpected: () => undefined,
      },
      {
        description:
          'returns invalid verified for impersonator, but includes verifications',
        getDid: () => impersonator,
        getExpected: () => ({
          verifications: [
            {
              createdAt: expect.any(String),
              isValid: true,
              issuer: verifier1,
              uri: expect.any(String),
            },
          ],
          verifiedStatus: 'invalid',
          trustedVerifierStatus: 'none',
        }),
        getExpectedUrisPrefixes: () => [
          `at://${verifier1}/app.bsky.graph.verification/`,
        ],
      },
    ]

    it.each(testCases)(
      '$description',
      async ({ getDid, getExpected, getExpectedUrisPrefixes = () => [] }) => {
        const profile = await getProfile(getDid())

        expect(profile.verification).toStrictEqual(getExpected())

        const urlPrefixes = getExpectedUrisPrefixes()
        profile.verification &&
          expect(urlPrefixes.length).toBe(
            profile.verification.verifications.length,
          )
        urlPrefixes.forEach((prefix, i) => {
          assert(profile.verification)
          expect(
            profile.verification.verifications[i].uri.startsWith(prefix),
          ).toBe(true)
        })
      },
    )
  })

  const getProfile = async (actor: string) => {
    const res = await agent.app.bsky.actor.getProfile(
      { actor },
      {
        headers: {
          ...(await network.serviceHeaders(alice, ids.AppBskyActorGetProfile)),
          'atproto-accept-labelers': `${labelerDid};redact`,
        },
      },
    )
    return res.data
  }

  const createLabel = async (opts: {
    src?: string
    uri: string
    cid: string
    val: string
    exp?: string
  }) => {
    await network.bsky.db.db
      .insertInto('label')
      .values({
        uri: opts.uri,
        cid: opts.cid,
        val: opts.val,
        cts: new Date().toISOString(),
        exp: opts.exp ?? null,
        neg: false,
        src: opts.src ?? labelerDid,
      })
      .execute()
  }
})
