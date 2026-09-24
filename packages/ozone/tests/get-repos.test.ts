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

describe('admin get multiple repos', () => {
  let network: TestNetwork
  let ozone: TestOzone
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient
  let modClient: ModeratorClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_admin_get_repos',
    })
    ozone = network.ozone
    agent = ozone.getAgent()
    pdsAgent = network.pds.getAgent()
    sc = network.getSeedClient()
    modClient = ozone.getModClient()
    await basicSeed(sc)
    await pdsAgent.com.atproto.server.deactivateAccount(
      {},
      { encoding: 'application/json', headers: sc.getHeaders(sc.dids.dan) },
    )
    await network.processAll()
  })

  beforeEach(async () => {
    await network.processAll()
  })

  afterAll(async () => {
    await network?.close()
  })

  beforeAll(async () => {
    await modClient.emitEvent({
      event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await sc.createReport({
      reportedBy: sc.dids.bob,
      reasonType: ComAtprotoModerationDefs.REASONSPAM,
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
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

  it('gets multiple repos by did', async () => {
    const { data } = await agent.tools.ozone.moderation.getRepos(
      { dids: [sc.dids.alice, sc.dids.bob, 'did:web:xyz'] },
      { headers: await ozone.modHeaders(ids.ToolsOzoneModerationGetRepos) },
    )

    expect(forSnapshot(data)).toMatchSnapshot()
  })
})
