import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { forSnapshot } from './_util'

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
  })

  afterAll(async () => {
    await network.close()
  })

  describe('list', () => {
    // @TODO: This tests encapsulates the entire grant->revoke->list flow. we should have more detailed test for each path
    it('returns paginated list of verifications', async () => {
      const {
        data: { verifications },
      } = await adminAgent.tools.ozone.verification.grant({
        verifications: [
          {
            subject: sc.dids.bob,
            handle: sc.accounts[sc.dids.bob].handle,
            displayName: 'Bob',
          },
          {
            subject: sc.dids.carol,
            handle: sc.accounts[sc.dids.carol].handle,
            displayName: 'Carol',
          },
        ],
      })

      const grantedVerificationUri =
        'uri' in verifications[0] ? verifications[0].uri : undefined
      if (grantedVerificationUri) {
        await adminAgent.tools.ozone.verification.revoke({
          uris: [grantedVerificationUri],
          revokeReason: 'Testing',
        })
      }

      const { data } = await adminAgent.tools.ozone.verification.list({})

      expect(forSnapshot(data.verifications)).toMatchSnapshot()
      expect(data.verifications.find((v) => v.revokedAt)?.uri).toEqual(
        grantedVerificationUri,
      )
    })
  })

  describe('grant', () => {
    it('Fails for non-admins', async () => {
      const attempt = triageAgent.tools.ozone.verification.grant({
        verifications: [
          {
            subject: sc.dids.bob,
            handle: sc.accounts[sc.dids.bob].handle,
            displayName: 'Bob',
          },
        ],
      })
      await expect(attempt).rejects.toThrow(
        'Must be a full admin to grant verifications',
      )
    })
  })
})
