import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, verificationsSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

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
    const getProfile = async (actor: string) => {
      const res = await agent.app.bsky.actor.getProfile(
        { actor },
        {
          headers: {
            ...(await network.serviceHeaders(
              alice,
              ids.AppBskyActorGetProfile,
            )),
            'atproto-accept-labelers': `${labelerDid};redact`,
          },
        },
      )
      return res.data
    }

    describe('verifier role', () => {
      it('returns verifier that has verifications', async () => {
        const profile = await getProfile(verifier1)

        expect(profile.verification).toStrictEqual({
          $type: 'app.bsky.actor.defs#verificationStateVerifier',
          role: 'verifier',
          isValid: true,
        })
      })

      it('returns verifier that has no verifications', async () => {
        const profile = await getProfile(verifier2)

        expect(profile.verification).toStrictEqual({
          $type: 'app.bsky.actor.defs#verificationStateVerifier',
          role: 'verifier',
          isValid: true,
        })
      })

      it('returns isValid=false for an impersonation', async () => {
        const profile = await getProfile(verifier3)

        expect(profile.verification).toStrictEqual({
          $type: 'app.bsky.actor.defs#verificationStateVerifier',
          role: 'verifier',
          isValid: false,
        })
      })
    })

    describe('default role', () => {
      it('returns isValid=true with multiple verifications', async () => {
        const profile = await getProfile(bob)

        expect(profile.verification).toStrictEqual({
          $type: 'app.bsky.actor.defs#verificationStateDefault',
          role: 'default',
          isValid: true,
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
        })
      })

      it('returns isValid=true with mixed valid and invalid verifications', async () => {
        const profile = await getProfile(carol)

        expect(profile.verification).toStrictEqual({
          $type: 'app.bsky.actor.defs#verificationStateDefault',
          role: 'default',
          isValid: true,
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
        })
      })

      it('returns isValid=true and excludes verifications by non-verifiers', async () => {
        const profile = await getProfile(dan)

        expect(profile.verification).toStrictEqual({
          $type: 'app.bsky.actor.defs#verificationStateDefault',
          role: 'default',
          isValid: true,
          verifications: [
            {
              createdAt: expect.any(String),
              isValid: true,
              issuer: verifier1,
              uri: expect.any(String),
            },
            // It has a verification by a non-verifier, which is not included.
          ],
        })
      })

      it('returns isValid=false for an impersonator, but includes the verification', async () => {
        const profile = await getProfile(impersonator)

        expect(profile.verification).toStrictEqual({
          $type: 'app.bsky.actor.defs#verificationStateDefault',
          role: 'default',
          isValid: false,
          verifications: [
            {
              createdAt: expect.any(String),
              isValid: true,
              issuer: verifier1,
              uri: expect.any(String),
            },
          ],
        })
      })

      it('returns isValid=false when has no verifications', async () => {
        const profile = await getProfile(eve)

        expect(profile.verification).toStrictEqual({
          $type: 'app.bsky.actor.defs#verificationStateDefault',
          role: 'default',
          isValid: false,
          verifications: [],
        })
      })

      it('returns isValid=false when has only invalid verifications from verifiers', async () => {
        const profile = await getProfile(frank)

        expect(profile.verification).toStrictEqual({
          $type: 'app.bsky.actor.defs#verificationStateDefault',
          role: 'default',
          isValid: false,
          verifications: [
            {
              createdAt: expect.any(String),
              isValid: false,
              issuer: verifier2,
              uri: expect.any(String),
            },
          ],
        })
      })

      it('returns isValid=false when has only verifications from non-verifiers', async () => {
        const profile = await getProfile(gus)

        expect(profile.verification).toStrictEqual({
          $type: 'app.bsky.actor.defs#verificationStateDefault',
          role: 'default',
          isValid: false,
          // This user has a verification but it is from a non-verifier, so it is omitted.
          verifications: [],
        })
      })
    })
  })

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
