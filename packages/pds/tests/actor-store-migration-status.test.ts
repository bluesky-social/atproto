import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'

describe('getActorStoreMigrationStatus', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'actor_store_migration_status',
    })
    agent = network.pds.getClient()
  })

  afterAll(async () => {
    await network.close()
  })

  it('requires admin auth', async () => {
    const attempt = agent.api.internal.pds.getActorStoreMigrationStatus()
    await expect(attempt).rejects.toThrow('Authentication Required')
  })

  it('returns migration status', async () => {
    const { data } = await agent.api.internal.pds.getActorStoreMigrationStatus(
      undefined,
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(data.allMigrated).toBe(true)
    expect(data.inProgressCount).toBe(0)
  })
})
