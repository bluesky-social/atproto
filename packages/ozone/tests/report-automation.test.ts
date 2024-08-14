import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { REASONOTHER } from '../src/lexicon/types/com/atproto/moderation/defs'
import { REVIEWESCALATED } from '../src/lexicon/types/tools/ozone/moderation/defs'

describe('reporting based automations', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_report_automation',
    })
    sc = network.getSeedClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    network.ozone.setAutomationConfig({
      autoLabelKeywords: ['label'],
      autoEscalatorDids: [sc.dids.bob],
      autoEscalateKeywords: ['escalate'],
      autoLabelerDids: [sc.dids.bob],
    })
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const getStatus = async (subject: string) => {
    const { subjectStatuses } = await modClient.queryStatuses({
      subject,
    })

    return subjectStatuses[0]
  }

  it('Automatically escalates and labels subjects', async () => {
    const post = sc.posts[sc.dids.alice][0]

    await sc.createReport({
      reasonType: REASONOTHER,
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: post.ref.uriStr,
        cid: post.ref.cidStr,
      },
      reason: 'escalate',
      reportedBy: sc.dids.bob,
    })
    const statusAfterEscalation = await getStatus(post.ref.uriStr)
    expect(statusAfterEscalation.reviewState).toEqual(REVIEWESCALATED)

    const labelEvent = 'tools.ozone.moderation.defs#modEventLabel'
    await sc.createReport({
      reasonType: REASONOTHER,
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: post.ref.uriStr,
        cid: post.ref.cidStr,
      },
      reason: 'this should trigger automation label:spam',
      reportedBy: sc.dids.bob,
    })
    const { events } = await modClient.queryEvents({
      subject: post.ref.uriStr,
      types: [labelEvent],
    })
    expect(events[0].event.comment).toContain('[automation-flow]')
    expect(events[0].event.createLabelVals).toContain('spam')
  })
})
