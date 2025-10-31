import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import { TOOLS_OZONE_TEAM } from '../src/lexicon'
import { ids } from '../src/lexicon/lexicons'

describe('get-config', () => {
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
        headers: await network.ozone.modHeaders(
          ids.ToolsOzoneServerGetConfig,
          role,
        ),
      },
    )
    return data
  }

  it('returns server config', async () => {
    const moderatorConfig = await getConfig('moderator')
    expect(moderatorConfig.appview?.url).toBe(network.ozone.ctx.cfg.appview.url)
    expect(moderatorConfig.pds?.url).toBe(network.ozone.ctx.cfg.pds?.url)
    expect(moderatorConfig.blobDivert?.url).toBe(
      network.ozone.ctx.cfg.blobDivert?.url,
    )
    expect(moderatorConfig.chat?.url).toBe(undefined)
    expect(moderatorConfig.viewer?.role).toEqual(
      TOOLS_OZONE_TEAM.DefsRoleModerator,
    )
  })

  it('returns the right role for the viewer', async () => {
    const adminConfig = await getConfig('admin')
    expect(adminConfig.viewer?.role).toBe(TOOLS_OZONE_TEAM.DefsRoleAdmin)
  })
})
