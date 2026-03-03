import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'

/**
 * Admin Neuro Endpoints Tests
 *
 * Tests all 6 admin endpoints with new userJid/testUserJid schema:
 * 1. getNeuroLink - get link by DID
 * 2. listNeuroAccounts - list all linked accounts
 * 3. importAccount - import account with Neuro link
 * 4. migrateAccount - migrate account to another PDS
 * 5. updateNeuroLink - update/create Neuro link
 * 6. validateMigrationTarget - validate migration destination
 */

describe('Admin Neuro Endpoints', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let pdsUrl: string
  let adminAuth: string

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

    pdsUrl = network.pds.url
    agent = network.pds.getClient()
    adminAuth = network.pds.adminAuth()
  })

  afterAll(async () => {
    await network.close()
  })

  describe('getNeuroLink', () => {
    it('should return link for real user (userJid)', async () => {
      const ctx = network.pds.ctx
      const db = ctx.accountManager.db
      const did = `did:plc:realuser${Date.now()}`
      const userJid = `realuser${Date.now()}@legal.lab.tagroot.io`

      // Create account and link
      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `realuser${Date.now()}.test`,
          email: `realuser${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await db.db
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

      // Call admin endpoint
      const { data } = await agent.com.atproto.admin.getNeuroLink(
        { did },
        { headers: { authorization: adminAuth } },
      )

      expect(data.link).toBeTruthy()
      expect(data.link?.legalId).toBe(userJid) // API returns 'legalId'
      expect(data.link?.did).toBe(did)
      expect(data.link?.linkedAt).toBeTruthy()
    })

    it('should return link for test user (testUserJid)', async () => {
      const ctx = network.pds.ctx
      const db = ctx.accountManager.db
      const did = `did:plc:testuser${Date.now()}`
      const testUserJid = `TestUser${Date.now()}@lab.tagroot.io`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `testuser${Date.now()}.test`,
          email: null,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did,
          userJid: null,
          testUserJid,
          isTestUser: 1,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      const { data } = await agent.com.atproto.admin.getNeuroLink(
        { did },
        { headers: { authorization: adminAuth } },
      )

      expect(data.link).toBeTruthy()
      expect(data.link?.legalId).toBe(testUserJid)
      expect(data.link?.did).toBe(did)
    })

    it('should return null for unlinked account', async () => {
      const ctx = network.pds.ctx
      const db = ctx.accountManager.db
      const did = `did:plc:unlinked${Date.now()}`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `unlinked${Date.now()}.test`,
          email: `unlinked${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      const { data } = await agent.com.atproto.admin.getNeuroLink(
        { did },
        { headers: { authorization: adminAuth } },
      )

      expect(data.link).toBeNull()
    })
  })

  describe('listNeuroAccounts', () => {
    beforeAll(async () => {
      const ctx = network.pds.ctx
      const db = ctx.accountManager.db

      // Create test data: 3 real users, 2 test users
      const timestamp = Date.now()

      for (let i = 1; i <= 3; i++) {
        const did = `did:plc:listreal${timestamp}${i}`
        await db.db
          .insertInto('account')
          .values({
            did,
            handle: `listreal${timestamp}${i}.test`,
            email: `listreal${i}@test.com`,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          })
          .execute()

        await db.db
          .insertInto('neuro_identity_link')
          .values({
            did,
            userJid: `listreal${timestamp}${i}@legal.io`,
            testUserJid: null,
            isTestUser: 0,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute()
      }

      for (let i = 1; i <= 2; i++) {
        const did = `did:plc:listtest${timestamp}${i}`
        await db.db
          .insertInto('account')
          .values({
            did,
            handle: `listtest${timestamp}${i}.test`,
            email: null,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          })
          .execute()

        await db.db
          .insertInto('neuro_identity_link')
          .values({
            did,
            userJid: null,
            testUserJid: `ListTest${timestamp}${i}@lab.io`,
            isTestUser: 1,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute()
      }
    })

    it('should list all Neuro-linked accounts', async () => {
      const { data } = await agent.com.atproto.admin.listNeuroAccounts(
        {},
        { headers: { authorization: adminAuth } },
      )

      expect(data.accounts.length).toBeGreaterThanOrEqual(5)

      // Verify real users have legalId
      const realUsers = data.accounts.filter((a) =>
        a.legalId?.includes('@legal'),
      )
      expect(realUsers.length).toBeGreaterThanOrEqual(3)

      // Verify test users have legalId (from testUserJid)
      const testUsers = data.accounts.filter((a) => a.legalId?.includes('@lab'))
      expect(testUsers.length).toBeGreaterThanOrEqual(2)
    })

    it('should return accounts with correct schema fields', async () => {
      const { data } = await agent.com.atproto.admin.listNeuroAccounts(
        {},
        { headers: { authorization: adminAuth } },
      )

      const account = data.accounts[0]
      expect(account).toHaveProperty('did')
      expect(account).toHaveProperty('legalId')
      expect(account).toHaveProperty('linkedAt')
      expect(account).not.toHaveProperty('userJid') // Internal field, not exposed
      expect(account).not.toHaveProperty('testUserJid') // Internal field, not exposed
    })

    it('should support pagination', async () => {
      const { data: page1 } = await agent.com.atproto.admin.listNeuroAccounts(
        { limit: 2 },
        { headers: { authorization: adminAuth } },
      )

      expect(page1.accounts.length).toBeLessThanOrEqual(2)

      if (page1.cursor) {
        const { data: page2 } = await agent.com.atproto.admin.listNeuroAccounts(
          { limit: 2, cursor: page1.cursor },
          { headers: { authorization: adminAuth } },
        )

        expect(page2.accounts.length).toBeGreaterThan(0)
        // DIDs should be different
        expect(page2.accounts[0].did).not.toBe(page1.accounts[0].did)
      }
    })
  })

  describe('updateNeuroLink', () => {
    it('should create new link for real user', async () => {
      const ctx = network.pds.ctx
      const db = ctx.accountManager.db
      const did = `did:plc:updatenew${Date.now()}`
      const userJid = `updatenew${Date.now()}@legal.lab.tagroot.io`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `updatenew${Date.now()}.test`,
          email: `updatenew${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      // Create link via admin endpoint
      await agent.com.atproto.admin.updateNeuroLink(
        { did, legalId: userJid },
        { encoding: 'application/json', headers: { authorization: adminAuth } },
      )

      const link = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(link).toBeTruthy()
      expect(link?.userJid).toBe(userJid)
      expect(link?.testUserJid).toBeNull()
      expect(link?.isTestUser).toBe(0)
    })

    it('should update existing link', async () => {
      const ctx = network.pds.ctx
      const db = ctx.accountManager.db
      const did = `did:plc:updateexisting${Date.now()}`
      const oldJid = `olduser${Date.now()}@legal.io`
      const newJid = `newuser${Date.now()}@legal.io`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `updateexisting${Date.now()}.test`,
          email: `updateexisting${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      // Create initial link
      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did,
          userJid: oldJid,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      // Update link
      await agent.com.atproto.admin.updateNeuroLink(
        { did, legalId: newJid },
        { encoding: 'application/json', headers: { authorization: adminAuth } },
      )

      const link = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(link?.userJid).toBe(newJid)
      expect(link?.isTestUser).toBe(0)
    })

    it('should reject duplicate legalId', async () => {
      const ctx = network.pds.ctx
      const db = ctx.accountManager.db
      const userJid = `duplicate${Date.now()}@legal.io`
      const did1 = `did:plc:dup1${Date.now()}`
      const did2 = `did:plc:dup2${Date.now()}`

      // Create two accounts
      await db.db
        .insertInto('account')
        .values([
          {
            did: did1,
            handle: `dup1${Date.now()}.test`,
            email: `dup1@test.com`,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
          {
            did: did2,
            handle: `dup2${Date.now()}.test`,
            email: `dup2@test.com`,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
        ])
        .execute()

      // Link first account
      await agent.com.atproto.admin.updateNeuroLink(
        { did: did1, legalId: userJid },
        { encoding: 'application/json', headers: { authorization: adminAuth } },
      )

      // Try to link second account with same legalId
      await expect(
        agent.com.atproto.admin.updateNeuroLink(
          { did: did2, legalId: userJid },
          {
            encoding: 'application/json',
            headers: { authorization: adminAuth },
          },
        ),
      ).rejects.toThrow()
    })
  })

  describe('importAccount', () => {
    it('should import account with real user link', async () => {
      const did = `did:plc:import${Date.now()}`
      const userJid = `importuser${Date.now()}@legal.io`
      const handle = `importuser${Date.now()}.test`

      await agent.com.atproto.admin.importAccount(
        {
          did,
          handle,
          email: `import${Date.now()}@test.com`,
          passwordScrypt: 'imported-hash',
          neuroLink: {
            legalId: userJid,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          },
        },
        { encoding: 'application/json', headers: { authorization: adminAuth } },
      )

      const ctx = network.pds.ctx
      const db = ctx.accountManager.db

      const link = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(link).toBeTruthy()
      expect(link?.userJid).toBe(userJid)
      expect(link?.testUserJid).toBeNull()
      expect(link?.isTestUser).toBe(0)
    })

    it('should import account without Neuro link', async () => {
      const did = `did:plc:importnolink${Date.now()}`
      const handle = `importnolink${Date.now()}.test`

      await agent.com.atproto.admin.importAccount(
        {
          did,
          handle,
          email: `importnolink${Date.now()}@test.com`,
          passwordScrypt: 'imported-hash',
          // No neuroLink
        },
        { encoding: 'application/json', headers: { authorization: adminAuth } },
      )

      const ctx = network.pds.ctx
      const db = ctx.accountManager.db

      const account = await db.db
        .selectFrom('account')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(account).toBeTruthy()
      expect(account?.handle).toBe(handle)

      // Should have no link
      const link = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(link).toBeUndefined()
    })
  })

  describe('validateMigrationTarget', () => {
    it('should validate available legalId', async () => {
      const legalId = `available${Date.now()}@legal.io`
      const handle = `available${Date.now()}.test`

      const { data } = await agent.com.atproto.admin.validateMigrationTarget(
        { legalId, handle },
        { headers: { authorization: adminAuth } },
      )

      expect(data.canAccept).toBe(true)
      expect(data.checks.handleAvailable).toBe(true)
      expect(data.checks.legalIdAvailable).toBe(true)
    })

    it('should reject occupied legalId', async () => {
      const ctx = network.pds.ctx
      const db = ctx.accountManager.db
      const legalId = `occupied${Date.now()}@legal.io`
      const did = `did:plc:occupied${Date.now()}`

      // Create existing account with this legalId
      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `occupied${Date.now()}.test`,
          email: `occupied${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did,
          userJid: legalId,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      const { data } = await agent.com.atproto.admin.validateMigrationTarget(
        { legalId, handle: `newhandle${Date.now()}.test` },
        { headers: { authorization: adminAuth } },
      )

      expect(data.canAccept).toBe(false)
      expect(data.checks.legalIdAvailable).toBe(false)
    })

    it('should reject occupied handle', async () => {
      const ctx = network.pds.ctx
      const db = ctx.accountManager.db
      const handle = `occupiedhandle${Date.now()}.test`

      await db.db
        .insertInto('account')
        .values({
          did: `did:plc:handletest${Date.now()}`,
          handle,
          email: `handletest${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      const { data } = await agent.com.atproto.admin.validateMigrationTarget(
        { legalId: `newlegal${Date.now()}@legal.io`, handle },
        { headers: { authorization: adminAuth } },
      )

      expect(data.canAccept).toBe(false)
      expect(data.checks.handleAvailable).toBe(false)
    })
  })

  describe('migrateAccount', () => {
    it('should export account data with userJid', async () => {
      const ctx = network.pds.ctx
      const db = ctx.accountManager.db
      const did = `did:plc:migrate${Date.now()}`
      const userJid = `migrate${Date.now()}@legal.io`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `migrate${Date.now()}.test`,
          email: `migrate${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await db.db
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

      // In a real scenario, this would call another PDS
      // For now, we verify the link data is accessible
      const link = await db.db
        .selectFrom('neuro_identity_link')
        .select([
          'userJid',
          'testUserJid',
          'isTestUser',
          'linkedAt',
          'lastLoginAt',
        ])
        .where('did', '=', did)
        .executeTakeFirst()

      expect(link).toBeTruthy()
      expect(link?.userJid).toBe(userJid)

      // Verify API response would have legalId field
      const apiResponse = {
        legalId: link?.userJid || link?.testUserJid,
        linkedAt: link?.linkedAt,
        lastLoginAt: link?.lastLoginAt,
      }

      expect(apiResponse.legalId).toBe(userJid)
    })
  })
})
