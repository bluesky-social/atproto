import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { forSnapshot } from './_util'

describe('verification-listener', () => {
  let network: TestNetwork
  let sc: SeedClient
  let adminAgent: AtpAgent

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_verification_test',
      ozone: {
        verifierUrl: 'http://localhost:2583',
        verifierDid: 'did:example:verifier',
        verifierPassword: 'test',
        jetstreamUrl: 'ws://any',
      },
    })
    sc = network.getSeedClient()
    await basicSeed(sc)

    adminAgent = network.pds.getClient()
    await adminAgent.login({
      identifier: sc.accounts[sc.dids.alice].handle,
      password: sc.accounts[sc.dids.alice].password,
    })
    await network.ozone.addAdminDid(sc.dids.alice)

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('indexes new and revoked verifications', async () => {
    const { verificationListener } = network.ozone.daemon.ctx
    verificationListener?.handleNewVerification({
      did: sc.dids.bob,
      time_us: 123456789,
      commit: {
        collection: 'app.bsky.graph.verification',
        rkey: 'abcdefg',
        record: {
          subject: sc.dids.alice,
          handle: sc.accounts[sc.dids.alice].handle,
          displayName: 'Alice',
          createdAt: new Date().toISOString(),
        },
      },
    })
    verificationListener?.handleDeletedVerification({
      did: sc.dids.bob,
      time_us: 123456799,
      commit: {
        collection: 'app.bsky.graph.verification',
        rkey: 'abcdefg',
      },
    })
    // Give the processor enough time to handle the events
    await new Promise((resolve) => setTimeout(() => resolve(true), 500))
    const {
      data: { verifications },
    } = await adminAgent.tools.ozone.verification.list({})
    const cursor = await verificationListener?.getCursor()

    expect(forSnapshot(verifications)).toMatchSnapshot()
    expect(cursor).toEqual(123456799)
  })
})
