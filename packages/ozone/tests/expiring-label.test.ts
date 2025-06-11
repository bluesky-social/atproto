import AtpAgent from '@atproto/api'
import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import { ids } from '../src/lexicon/lexicons'

describe('expiring label', () => {
  let network: TestNetwork
  let sc: SeedClient
  let modClient: ModeratorClient
  let agent: AtpAgent

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_expiring_label_test',
    })
    sc = network.getSeedClient()
    agent = network.ozone.getClient()
    modClient = network.ozone.getModClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const emitExpiringLabel = async (did: string) =>
    modClient.emitEvent(
      {
        subject: { $type: 'com.atproto.admin.defs#repoRef', did },
        event: {
          $type: 'tools.ozone.moderation.defs#modEventLabel',
          comment: 'Testing expiring label',
          createLabelVals: ['expiring'],
          negateLabelVals: [],
          durationInHours: 1,
        },
        createdBy: sc.dids.alice,
      },
      'moderator',
    )

  it('Returns expiring label only within expiration period', async () => {
    const getRepo = async (did: string) =>
      agent.tools.ozone.moderation.getRepo(
        { did },
        {
          headers: await network.ozone.modHeaders(
            ids.ToolsOzoneModerationGetRepo,
          ),
        },
      )

    const now = new Date().toISOString()
    await emitExpiringLabel(sc.dids.carol)
    const { data: repoWithExpiringLabel } = await getRepo(sc.dids.carol)
    expect(repoWithExpiringLabel.labels?.[0].val).toEqual('expiring')
    // Manually expire the label in db
    await network.ozone.ctx.db.db
      .updateTable('label')
      .set({ exp: now })
      .where('uri', '=', sc.dids.carol)
      .execute()

    const { data: repoAfterExpiringLabel } = await getRepo(sc.dids.carol)
    expect(repoAfterExpiringLabel.labels?.length).toEqual(0)
  })
})
