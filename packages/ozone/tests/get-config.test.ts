import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import AtpAgent from '@atproto/api'
import { forSnapshot } from './_util'

describe('communication-templates', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_server_config',
    })
    agent = network.ozone.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const getConfig = async (role: 'moderator' | 'admin' | 'triage') => {
    const { data } = await agent.api.tools.ozone.server.getConfig(
      {},
      {
        headers: await network.ozone.modHeaders(role),
      },
    )
    return data
  }

  it('returns server config', async () => {
    const moderatorConfig = await getConfig('moderator')
    console.log(moderatorConfig)
    expect(forSnapshot(moderatorConfig)).toMatchSnapshot()
  })

  it('returns the right role for the viewer', async () => {
    const [moderatorConfig, adminConfig] = await Promise.all([
      getConfig('moderator'),
      getConfig('admin'),
    ])
    expect(moderatorConfig.viewerRole).toBe('moderator')
    expect(adminConfig.viewerRole).toBe('admin')
  })
})
