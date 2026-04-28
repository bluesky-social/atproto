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

describe('get-reported-subjects', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  let aliceAgent: AtpAgent
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
    await sc.createReport({
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.bob][0].ref.uriStr,
        cid: sc.posts[sc.dids.bob][0].ref.cidStr,
      },
      reasonType: REASONSPAM,
      reason: 'carol also says bob cannot post',
      reportedBy: sc.dids.carol,
    })
  }

  const proxyHeaders = () => ({
    'atproto-proxy': `${network.ozone.ctx.cfg.service.did}#atproto_labeler`,
  })

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_get_reported_subjects',
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
    carolAgent = network.pds.getAgent()
    await carolAgent.login({
      identifier: sc.accounts[sc.dids.carol].handle,
      password: sc.accounts[sc.dids.carol].password,
    })
  })

  afterAll(async () => {
    await network.close()
  })

  it('returns reported subjects with comments and status', async () => {
    const { data: alicesReported } =
      await aliceAgent.tools.ozone.history.getReportedSubjects(
        {},
        { headers: proxyHeaders() },
      )
    const { data: carolsReported } =
      await carolAgent.tools.ozone.history.getReportedSubjects(
        {},
        { headers: proxyHeaders() },
      )

    // Alice reported 4 subjects, carol reported 1
    expect(alicesReported.subjects.length).toBe(4)
    expect(carolsReported.subjects.length).toBe(1)

    // All should have open status and no actions yet
    for (const subject of alicesReported.subjects) {
      expect(subject.status).toBe('open')
      expect(subject.actions).toEqual([])
    }

    // Check comment is included
    expect(alicesReported.subjects[0].comment).toBeDefined()
    expect(forSnapshot(alicesReported.subjects)).toMatchSnapshot()
    expect(forSnapshot(carolsReported.subjects)).toMatchSnapshot()
  })

  it('shows actions on reported subjects after mod action', async () => {
    // Action bob's post with a label, targeting all reports
    await modClient.emitEvent(
      {
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          createLabelVals: ['spam'],
          negateLabelVals: [],
        },
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.bob][0].ref.uriStr,
          cid: sc.posts[sc.dids.bob][0].ref.cidStr,
        },
        reportAction: {
          all: true,
        },
      },
      'admin',
    )

    const { data: alicesReported } =
      await aliceAgent.tools.ozone.history.getReportedSubjects(
        {},
        { headers: proxyHeaders() },
      )

    // Find the report about bob's post
    const bobPostReport = alicesReported.subjects.find(
      (item) => item.subject === sc.posts[sc.dids.bob][0].ref.uriStr,
    )

    // Should now have an action
    expect(bobPostReport?.actions?.length).toBeGreaterThan(0)
    expect(bobPostReport?.actions?.[0].event.$type).toBe(
      'tools.ozone.history.defs#eventLabel',
    )
  })
})
