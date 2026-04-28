import { AtpAgent } from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import {
  REASONMISLEADING,
  REASONSPAM,
} from '../src/lexicon/types/com/atproto/moderation/defs'
import { forSnapshot } from './_util'

describe('get-account-actions', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  let aliceAgent: AtpAgent
  let bobAgent: AtpAgent
  let carolAgent: AtpAgent

  const seedReports = async () => {
    await sc.createReport({
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.carol,
      },
      reasonType: REASONMISLEADING,
      reason: 'alice says carol is bad',
      reportedBy: sc.dids.alice,
    })
    await sc.createReport({
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.carol][0].ref.uriStr,
        cid: sc.posts[sc.dids.carol][0].ref.cidStr,
      },
      reasonType: REASONMISLEADING,
      reason: 'alice says carol cannot post',
      reportedBy: sc.dids.alice,
    })
    await sc.createReport({
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.bob,
      },
      reasonType: REASONSPAM,
      reason: 'alice says bob is bad',
      reportedBy: sc.dids.alice,
    })
    await sc.createReport({
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.bob][0].ref.uriStr,
        cid: sc.posts[sc.dids.bob][0].ref.cidStr,
      },
      reasonType: REASONSPAM,
      reason: 'alice says bob cannot post',
      reportedBy: sc.dids.alice,
    })
  }

  const proxyHeaders = () => ({
    'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
  })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_get_account_actions',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
    await seedReports()

    aliceAgent = network.pds.getAgent()
    await aliceAgent.login({
      identifier: sc.accounts[sc.dids.alice].handle,
      password: sc.accounts[sc.dids.alice].password,
    })
    bobAgent = network.pds.getAgent()
    await bobAgent.login({
      identifier: sc.accounts[sc.dids.bob].handle,
      password: sc.accounts[sc.dids.bob].password,
    })
    carolAgent = network.pds.getAgent()
    await carolAgent.login({
      identifier: sc.accounts[sc.dids.carol].handle,
      password: sc.accounts[sc.dids.carol].password,
    })
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns empty actions when no mod actions have been taken', async () => {
    const { data: carolData } =
      await carolAgent.tools.ozone.history.getAccountActions(
        {},
        { headers: proxyHeaders() },
      )
    const { data: bobData } =
      await bobAgent.tools.ozone.history.getAccountActions(
        {},
        { headers: proxyHeaders() },
      )

    // No mod actions (takedown/label/reverseTakedown) have been taken yet
    expect(carolData.events).toEqual([])
    expect(bobData.events).toEqual([])
  })

  it('returns action events after mod action', async () => {
    const bobsPostSubject = {
      $type: 'com.atproto.repo.strongRef',
      uri: sc.posts[sc.dids.bob][0].ref.uriStr,
      cid: sc.posts[sc.dids.bob][0].ref.cidStr,
    }
    await modClient.emitEvent(
      {
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['spam'],
          negateLabelVals: [],
        },
        subject: bobsPostSubject,
      },
      'admin',
    )

    const { data } = await bobAgent.tools.ozone.history.getAccountActions(
      {},
      { headers: proxyHeaders() },
    )

    expect(data.events.length).toBe(1)
    expect(data.events[0].event.$type).toBe(
      'tools.ozone.history.defs#eventLabel',
    )
    expect(forSnapshot(data.events)).toMatchSnapshot()
  })

  it('shows subject history for a specific subject', async () => {
    const { data } = await bobAgent.tools.ozone.history.getSubjectHistory(
      { subject: sc.posts[sc.dids.bob][0].ref.uriStr },
      { headers: proxyHeaders() },
    )

    expect(forSnapshot(data.events)).toMatchSnapshot()
  })

  it('does not show subject history of a different user', async () => {
    await expect(
      carolAgent.tools.ozone.history.getSubjectHistory(
        { subject: sc.posts[sc.dids.bob][0].ref.uriStr },
        { headers: proxyHeaders() },
      ),
    ).rejects.toThrow('Unauthorized')
  })
})
