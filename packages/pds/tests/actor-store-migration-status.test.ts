import { TestNetworkNoAppView } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { internal } from '../src/lexicons.js'

describe('getActorStoreMigrationStatus', () => {
  let network: TestNetworkNoAppView
  let client: Client

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'actor_store_migration_status',
    })
    client = network.pds.getClient()
  })

  afterAll(async () => {
    await network.close()
  })

  it('requires admin auth', async () => {
    const attempt = client.call(internal.pds.getActorStoreMigrationStatus)
    await expect(attempt).rejects.toThrow('Authentication Required')
  })

  it('returns migration status', async () => {
    const data = await client.call(
      internal.pds.getActorStoreMigrationStatus,
      {},
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(data.allMigrated).toBe(true)
    expect(data.inProgressCount).toBe(0)
  })
})
