import {
  ModeratorClient,
  SeedClient,
  TestNetwork,
  basicSeed,
} from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { REASONSPAM } from '../src/lexicon/types/com/atproto/moderation/defs'
import { forSnapshot } from './_util'

describe('moderation status language tagging', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient
  let ozoneClient: AtpAgent

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_describe_server_test',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    ozoneClient = network.ozone.getClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  it('gets server details with moderators', async () => {
    const { data } = await ozoneClient.api.tools.ozone.server.describeServer(
      {},
      { headers: await network.ozone.modHeaders() },
    )

    expect(forSnapshot(data)).toMatchSnapshot()
  })
})
