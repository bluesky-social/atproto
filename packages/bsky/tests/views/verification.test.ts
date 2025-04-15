import assert from 'node:assert'
import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, verificationsSeed } from '@atproto/dev-env'
import { ids } from '../../src/lexicon/lexicons'

describe('verification views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
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
    pdsAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await verificationsSeed(sc)

    labelerDid = network.bsky.ctx.cfg.labelsFromIssuerDids[0]
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
    describe('profileViewDetailed', () => {
      const getProfile = async (actor: string) => {
        const res = await agent.app.bsky.actor.getProfile(
          { actor },
          {
            headers: {
              ...(await network.serviceHeaders(
                alice,
                ids.AppBskyActorGetProfile,
              )),
              'atproto-accept-labelers': labelerDid,
            },
          },
        )
        return res.data
      }

      describe('when verifier', () => {
        it('returns verifier that has verifications', async () => {
          const profile = await getProfile(verifier1)

          expect(profile.verification).toStrictEqual({
            level: 'verifier',
            verifications: [
              {
                createdAt: expect.any(String),
                displayName: 'display-verifier1',
                handle: 'verifier1.test',
                issuer: verifier2,
                uri: expect.any(String),
              },
            ],
          })
          expect(
            profile.verification!.verifications?.[0].uri.startsWith(
              `at://${verifier2}/app.bsky.graph.verification`,
            ),
          ).toBeTruthy()
        })

        it('returns verifier that has no verifications', async () => {
          const profile = await getProfile(verifier2)

          expect(profile.verification).toStrictEqual({
            level: 'verifier',
            verifications: [],
          })
        })

        it('returns unverified for an impersonator', async () => {
          const profile = await getProfile(verifier3)

          expect(profile.verification).toStrictEqual({
            level: 'unverified',
            verifications: [],
          })
        })
      })

      describe('when verified', () => {
        it('returns verified with multiple verifications', async () => {
          const profile = await getProfile(bob)

          expect(profile.verification).toStrictEqual({
            level: 'verified',
            verifications: [
              {
                createdAt: expect.any(String),
                displayName: 'display-bob',
                handle: 'bob.test',
                issuer: verifier1,
                uri: expect.any(String),
              },
              {
                createdAt: expect.any(String),
                displayName: 'display-bob',
                handle: 'bob.test',
                issuer: verifier2,
                uri: expect.any(String),
              },
            ],
          })
        })

        it('returns verified with mixed non-broken and broken verifications', async () => {
          const profile = await getProfile(carol)

          expect(profile.verification).toStrictEqual({
            level: 'verified',
            verifications: [
              {
                createdAt: expect.any(String),
                displayName: 'display-carol',
                handle: 'carol.test',
                issuer: verifier1,
                uri: expect.any(String),
              },
              {
                createdAt: expect.any(String),
                displayName: 'display-carol',
                // Returns the outdated handle so the client can check that to omit this verification in the list.
                handle: 'carol.old.handle',
                issuer: verifier2,
                uri: expect.any(String),
              },
            ],
          })
        })

        it('returns verified without including non-verifiers', async () => {
          const profile = await getProfile(dan)

          expect(profile.verification).toStrictEqual({
            level: 'verified',
            verifications: [
              {
                createdAt: expect.any(String),
                displayName: 'display-dan',
                handle: 'dan.test',
                issuer: verifier1,
                uri: expect.any(String),
              },
              // It has a verification by a non-verifier, which is not included.
            ],
          })
        })

        it('returns unverified for an impersonator', async () => {
          const profile = await getProfile(impersonator)

          expect(profile.verification).toStrictEqual({
            level: 'unverified',
            // It has a verification but it loses it by being an impersonator.
            verifications: [],
          })
        })
      })

      describe('when unverified', () => {
        it('returns unverified when has no verifications', async () => {
          const profile = await getProfile(eve)

          expect(profile.verification).toStrictEqual({
            level: 'unverified',
            verifications: [],
          })
        })

        it('returns unverified when has only broken verifications from verifiers', async () => {
          const profile = await getProfile(frank)

          expect(profile.verification).toStrictEqual({
            level: 'unverified',
            verifications: [
              {
                createdAt: expect.any(String),
                displayName: 'frank-old-name', // Broken, verification name does not match current name.
                handle: 'frank.test',
                issuer: verifier2,
                uri: expect.any(String),
              },
            ],
          })
        })

        it('returns unverified when has only verifications from non-verifiers', async () => {
          const profile = await getProfile(gus)

          expect(profile.verification).toStrictEqual({
            level: 'unverified',
            // This user has a verification but it is from a non-verifier, so it is omitted.
            verifications: [],
          })
        })
      })
    })
  })

  describe('profileView', () => {
    const getFollowsSubject = async (actor: string) => {
      await pdsAgent.app.bsky.graph.follow.create(
        { repo: actor },
        {
          subject: alice,
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(actor),
      )
      await network.processAll()
      const view = await agent.app.bsky.graph.getFollows(
        { actor },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyGraphGetFollows,
          ),
        },
      )

      return view.data.subject
    }

    describe('when verifier', () => {
      it('returns verifier that has verifications', async () => {
        const subject = await getFollowsSubject(verifier1)

        expect(subject.verification).toStrictEqual({
          level: 'verifier',
        })
      })

      it('returns verifier that has no verifications', async () => {
        const subject = await getFollowsSubject(verifier2)

        expect(subject.verification).toStrictEqual({
          level: 'verifier',
        })
      })
    })

    describe('when verified', () => {
      it('returns verified with multiple verifications', async () => {
        const subject = await getFollowsSubject(bob)

        expect(subject.verification).toStrictEqual({
          level: 'verified',
        })
      })

      it('returns verified with mixed non-broken and broken verifications', async () => {
        const subject = await getFollowsSubject(carol)

        expect(subject.verification).toStrictEqual({
          level: 'verified',
        })
      })

      it('returns verified without including non-verifiers', async () => {
        const subject = await getFollowsSubject(dan)

        expect(subject.verification).toStrictEqual({
          level: 'verified',
        })
      })
    })

    describe('when unverified', () => {
      it('returns unverified when has no verifications', async () => {
        const subject = await getFollowsSubject(eve)

        expect(subject.verification).toStrictEqual({
          level: 'unverified',
        })
      })

      it('returns unverified when has only broken verifications from verifiers', async () => {
        const subject = await getFollowsSubject(frank)

        expect(subject.verification).toStrictEqual({
          level: 'unverified',
        })
      })

      it('returns unverified when has only verifications from non-verifiers', async () => {
        const subject = await getFollowsSubject(gus)

        expect(subject.verification).toStrictEqual({
          level: 'unverified',
        })
      })
    })
  })

  describe('profileViewBasic', () => {
    const getPost = async (actor: string) => {
      const res = await pdsAgent.app.bsky.feed.post.create(
        { repo: actor },
        {
          text: 'hi',
          createdAt: new Date().toISOString(),
        },
        sc.getHeaders(actor),
      )
      await network.processAll()
      const view = await agent.app.bsky.feed.getPosts(
        { uris: [res.uri] },
        {
          headers: await network.serviceHeaders(
            sc.dids.alice,
            ids.AppBskyFeedGetPosts,
          ),
        },
      )

      assert(view.data.posts[0])
      return view.data.posts[0]
    }

    describe('when verifier', () => {
      it('returns verifier that has verifications', async () => {
        const post = await getPost(verifier1)

        expect(post.author.verification).toStrictEqual({
          level: 'verifier',
        })
      })

      it('returns verifier that has no verifications', async () => {
        const post = await getPost(verifier2)

        expect(post.author.verification).toStrictEqual({
          level: 'verifier',
        })
      })
    })

    describe('when verified', () => {
      it('returns verified with multiple verifications', async () => {
        const post = await getPost(bob)

        expect(post.author.verification).toStrictEqual({
          level: 'verified',
        })
      })

      it('returns verified with mixed non-broken and broken verifications', async () => {
        const post = await getPost(carol)

        expect(post.author.verification).toStrictEqual({
          level: 'verified',
        })
      })

      it('returns verified without including non-verifiers', async () => {
        const post = await getPost(dan)

        expect(post.author.verification).toStrictEqual({
          level: 'verified',
        })
      })
    })

    describe('when unverified', () => {
      it('returns unverified when has no verifications', async () => {
        const post = await getPost(eve)

        expect(post.author.verification).toStrictEqual({
          level: 'unverified',
        })
      })

      it('returns unverified when has only broken verifications from verifiers', async () => {
        const post = await getPost(frank)

        expect(post.author.verification).toStrictEqual({
          level: 'unverified',
        })
      })

      it('returns unverified when has only verifications from non-verifiers', async () => {
        const post = await getPost(gus)

        expect(post.author.verification).toStrictEqual({
          level: 'unverified',
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
