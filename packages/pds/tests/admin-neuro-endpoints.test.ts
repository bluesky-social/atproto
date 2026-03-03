import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'

describe('Admin Neuro Endpoints', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let adminAuth: string

  const insertFixture = async (did: string, handle: string, email?: string) => {
    const db = network.pds.ctx.accountManager.db.db
    const now = new Date().toISOString()

    await db
      .insertInto('actor')
      .values({
        did,
        handle,
        createdAt: now,
        takedownRef: null,
        deactivatedAt: null,
        deleteAfter: null,
      })
      .execute()

    if (email !== undefined) {
      await db
        .insertInto('account')
        .values({ did, email, passwordScrypt: 'fake-hash' })
        .execute()
    }
  }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      pds: {
        neuro: {
          enabled: true,
          domain: 'test.lab.tagroot.io',
          storageBackend: 'database' as const,
        },
      },
      dbPostgresSchema: 'admin_neuro_endpoints',
    })

    agent = network.pds.getClient()
    adminAuth = network.pds.adminAuth()
  })

  afterAll(async () => {
    await network.close()
  })

  it('getNeuroLink returns mapped legalId from userJid', async () => {
    const did = `did:plc:getlink${Date.now()}`
    const userJid = `getlink${Date.now()}@legal.io`
    await insertFixture(did, `getlink${Date.now()}.test`, `getlink@test.com`)

    await network.pds.ctx.accountManager.db.db
      .insertInto('neuro_identity_link')
      .values({
        did,
        userJid,
        testUserJid: null,
        isTestUser: 0,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()

    const { data } = await agent.com.atproto.admin.getNeuroLink(
      { did },
      { headers: { authorization: adminAuth } },
    )

    expect(data.did).toBe(did)
    expect(data.legalId).toBe(userJid)
  })

  it('listNeuroAccounts returns linked entries', async () => {
    const did = `did:plc:list${Date.now()}`
    await insertFixture(did, `list${Date.now()}.test`, `list@test.com`)

    await network.pds.ctx.accountManager.db.db
      .insertInto('neuro_identity_link')
      .values({
        did,
        userJid: `list${Date.now()}@legal.io`,
        testUserJid: null,
        isTestUser: 0,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()

    const { data } = await agent.com.atproto.admin.listNeuroAccounts(
      { limit: 10 },
      { headers: { authorization: adminAuth } },
    )

    expect(data.accounts.find((a) => a.did === did)).toBeDefined()
  })

  it('updateNeuroLink creates and updates a link', async () => {
    const did = `did:plc:update${Date.now()}`
    const first = `first${Date.now()}@legal.io`
    const second = `second${Date.now()}@legal.io`
    await insertFixture(did, `update${Date.now()}.test`, `update@test.com`)

    await agent.com.atproto.admin.updateNeuroLink(
      { did, newLegalId: first },
      { encoding: 'application/json', headers: { authorization: adminAuth } },
    )

    await agent.com.atproto.admin.updateNeuroLink(
      { did, newLegalId: second },
      { encoding: 'application/json', headers: { authorization: adminAuth } },
    )

    const row = await network.pds.ctx.accountManager.db.db
      .selectFrom('neuro_identity_link')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

    expect(row?.userJid).toBe(second)
    expect(row?.isTestUser).toBe(0)
  })

  it('validateMigrationTarget checks legalId and handle availability', async () => {
    const did = `did:plc:validate${Date.now()}`
    const legalId = `validate${Date.now()}@legal.io`
    const occupiedHandle = `occupied${Date.now()}.test`

    await insertFixture(
      `did:plc:occupied${Date.now()}`,
      occupiedHandle,
      `occupied${Date.now()}@test.com`,
    )

    const { data } = await agent.com.atproto.admin.validateMigrationTarget(
      { did, legalId, targetHandle: occupiedHandle },
      { headers: { authorization: adminAuth } },
    )

    expect(data.canAccept).toBe(false)
    expect(data.checks.handleAvailable).toBe(false)
  })

  it('importAccount works with service auth headers', async () => {
    const actor = await agent.api.com.atproto.server.createAccount({
      email: `svc${Date.now()}@test.com`,
      handle: `svc${Date.now()}.test`,
      password: 'test-password-123',
    })

    const headers = await network.pds.ctx.serviceAuthHeaders(
      actor.data.did,
      network.pds.ctx.cfg.service.did,
      'com.atproto.admin.importAccount',
    )

    const did = `did:plc:import${Date.now()}`
    const handle = `import${Date.now()}.test`

    const { data } = await agent.com.atproto.admin.importAccount(
      {
        did,
        handle,
        email: `import${Date.now()}@test.com`,
        emailConfirmed: true,
      },
      { ...headers, encoding: 'application/json' },
    )

    expect(data.did).toBe(did)
    expect(data.importStatus.accountCreated).toBe(true)

    const actorRow = await network.pds.ctx.accountManager.db.db
      .selectFrom('actor')
      .select(['did', 'handle'])
      .where('did', '=', did)
      .executeTakeFirst()

    expect(actorRow?.handle).toBe(handle)
  })
})
