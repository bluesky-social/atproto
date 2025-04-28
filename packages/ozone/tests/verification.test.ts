import { AppBskyActorDefs, AtpAgent, asPredicate } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { forSnapshot } from './_util'

const isValidProfile = asPredicate(AppBskyActorDefs.validateProfileViewDetailed)

describe('verification', () => {
  let network: TestNetwork
  let adminAgent: AtpAgent
  let triageAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_verification_test',
    })
    adminAgent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()

    await network.ozone.addAdminDid(sc.dids.alice)
    await network.ozone.addModeratorDid(sc.dids.bob)
    await network.ozone.addTriageDid(sc.dids.carol)
    await adminAgent.login({
      identifier: sc.accounts[sc.dids.alice].handle,
      password: sc.accounts[sc.dids.alice].password,
    })
    triageAgent = network.pds.getClient()
    await triageAgent.login({
      identifier: sc.accounts[sc.dids.carol].handle,
      password: sc.accounts[sc.dids.carol].password,
    })
    const {
      data: { password },
    } = await adminAgent.com.atproto.server.createAppPassword({
      name: 'verifier',
    })
    network.ozone.ctx.cfg.verifier = {
      url: network.pds.url,
      did: sc.dids.alice,
      password,
    }

    await network.processAll()
    await network.bsky.db.db
      .updateTable('actor')
      .set({ trustedVerifier: true })
      .where('did', 'in', [sc.dids.alice])
      .execute()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('list', () => {
    // @TODO: This tests encapsulates the entire grant->revoke->list flow. we should have more detailed test for each path
    it('returns paginated list of verifications', async () => {
      const {
        data: { verifications },
      } = await adminAgent.tools.ozone.verification.grantVerifications({
        verifications: [
          {
            subject: sc.dids.bob,
            handle: sc.accounts[sc.dids.bob].handle,
            displayName: 'bobby',
          },
          {
            subject: sc.dids.carol,
            handle: sc.accounts[sc.dids.carol].handle,
            displayName: '',
          },
        ],
      })

      const grantedVerificationUri = verifications.find(
        (v) => v.subject === sc.dids.carol,
      )?.uri

      expect(grantedVerificationUri).toBeDefined()

      if (grantedVerificationUri) {
        await adminAgent.tools.ozone.verification.revokeVerifications({
          uris: [grantedVerificationUri],
          revokeReason: 'Testing',
        })
      }

      await network.processAll()

      const { data } =
        await adminAgent.tools.ozone.verification.listVerifications({})

      expect(data.verifications.find((v) => v.revokedAt)?.uri).toEqual(
        grantedVerificationUri,
      )
      const bob = data.verifications.find((v) => v.subject === sc.dids.bob)
      const carol = data.verifications.find((v) => v.subject === sc.dids.carol)

      if (
        !isValidProfile(bob?.subjectProfile) ||
        !isValidProfile(carol?.subjectProfile)
      ) {
        throw Error('Invalid profiles')
      }

      expect(forSnapshot(bob)).toMatchSnapshot()
      expect(forSnapshot(carol)).toMatchSnapshot()

      // Assert that profile record carries valid verification status for bob but not for carol
      expect(carol.revokedAt).toBeDefined()
      expect(carol.revokeReason).toEqual('Testing')
      expect(carol.subjectProfile.verification).toBeUndefined()
      expect(bob.subjectProfile?.verification?.verifiedStatus).toEqual('valid')
    })
  })

  describe('grant', () => {
    it('fails for non-admins and non-verifiers', async () => {
      const attemptAsAdmin =
        triageAgent.tools.ozone.verification.grantVerifications({
          verifications: [
            {
              subject: sc.dids.bob,
              handle: sc.accounts[sc.dids.bob].handle,
              displayName: 'Bob',
            },
          ],
        })
      await expect(attemptAsAdmin).rejects.toThrow(
        'Must be an admin or verifier to grant verifications',
      )
    })
  })

  it('does not publish record if a valid one already exists', async () => {
    const { data: beforePublish } =
      await adminAgent.tools.ozone.verification.listVerifications({
        subjects: [sc.dids.bob],
      })
    const {
      data: { verifications },
    } = await adminAgent.tools.ozone.verification.grantVerifications({
      verifications: [
        {
          subject: sc.dids.bob,
          handle: sc.accounts[sc.dids.bob].handle,
          displayName: 'bobby',
        },
      ],
    })

    const { data: afterPublish } =
      await adminAgent.tools.ozone.verification.listVerifications({
        subjects: [sc.dids.bob],
      })

    // assert that the response does not contain any new verification
    expect(verifications.length).toEqual(0)
    // assert that the list of verifications in db hasn't changed
    expect(afterPublish.verifications.length).toEqual(
      beforePublish.verifications.length,
    )
  })
})
