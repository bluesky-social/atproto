import AtpAgent from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { REASONSPAM } from '../dist/lexicon/types/com/atproto/moderation/defs'
import { ids } from '../src/lexicon/lexicons'
import { forSnapshot } from './_util'

describe('account timeline', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  let agent: AtpAgent

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_account_timeline_test',
    })
    sc = network.getSeedClient()
    agent = network.ozone.getClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)

    // Trigger some moderation events
    await Promise.all([
      sc.createReport({
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice,
        },
        reasonType: REASONSPAM,
        reportedBy: sc.dids.bob,
      }),
      sc.createReport({
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: sc.dids.alice,
        },
        reasonType: REASONSPAM,
        reportedBy: sc.dids.carol,
      }),
      sc.createReport({
        subject: {
          $type: 'com.atproto.repo.strongRef',
          uri: sc.posts[sc.dids.alice][0].ref.uriStr,
          cid: sc.posts[sc.dids.alice][0].ref.cidStr,
        },
        reasonType: REASONSPAM,
        reportedBy: sc.dids.bob,
      }),
    ])
    await modClient.performTakedown({
      subject: {
        $type: 'com.atproto.admin.defs#repoRef',
        did: sc.dids.alice,
      },
    })
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('Returns entire timeline of events for a given account', async () => {
    const getAccountTimeline = async (did: string) =>
      agent.tools.ozone.moderation.getAccountTimeline(
        { did },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneModerationGetAccountTimeline,
          ),
        },
      )

    const {
      data: { timeline },
    } = await getAccountTimeline(sc.dids.alice)

    expect(forSnapshot(timeline[0].summary)).toMatchSnapshot()
  })
})
