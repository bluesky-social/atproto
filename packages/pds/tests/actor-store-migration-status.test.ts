import { TestNetworkNoAppView } from '@atproto/dev-env'
import { Client } from '@atproto/lex'
import { com } from '../src/lexicons.js'

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
    const attempt = client.call(
      com.atproto.unspecced.getActorStoreMigrationStatus,
    )
    await expect(attempt).rejects.toThrow('Authentication Required')
  })

  it('returns migration status', async () => {
    const data = await client.call(
      com.atproto.unspecced.getActorStoreMigrationStatus,
      {},
      { headers: network.pds.adminAuthHeaders() },
    )
    expect(data.allMigrated).toBe(true)
    expect(data.inProgressCount).toBe(0)
  })
})
