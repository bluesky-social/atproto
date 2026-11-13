import { ComAtprotoModerationDefs, ids } from '@atproto/api'
import type { AtpAgent } from '@atproto/api'
import {
  type ModeratorClient,
  type SeedClient,
  TestNetwork,
  type TestOzone,
  basicSeed,
} from '@atproto/dev-env'
import { forSnapshot } from './_util.js'

describe('admin get multiple subjects with all relevant details', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_admin_get_subjects',
    })
    ozone = network.ozone
    agent = ozone.getAgent()
    sc = network.getSeedClient()
    modClient = ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  beforeEach(async () => {
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  beforeAll(async () => {
    await sc.createReport({
      reportedBy: sc.dids.bob,
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: {
        $type: 'com.atproto.repo.strongRef',
        uri: sc.posts[sc.dids.alice][0].ref.uriStr,
        cid: sc.posts[sc.dids.alice][0].ref.cidStr,
      },
    })
    await sc.createReport({
      reportedBy: sc.dids.carol,
      reasonType: ComAtprotoModerationDefs.REASONOTHER,
      reason: 'defamation',
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
  })

  it('gets multiple subjects with records', async () => {
    const {
      data: { subjects },
    } = await agent.tools.ozone.moderation.getSubjects(
      { subjects: [sc.dids.alice, sc.posts[sc.dids.alice][0].ref.uriStr] },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetSubjects) },
    )

    expect(forSnapshot(subjects)).toMatchSnapshot()
  })
})
