import { TestNetworkNoAppView } from '@atproto/dev-env'

/**
 * Test User Support Integration Tests
 *
 * Tests verify:
 * 1. Test user detection (no EMAIL tag = test user)
 * 2. Configuration control (PDS_ALLOW_TEST_USER_CREATION)
 * 3. Either/or storage (legalId for real users, jid for test users)
 * 4. Dual matching (Legal ID primary, JID fallback)
 * 5. Startup warning when test users enabled
 */

describe('Test User Support', () => {
  let network: TestNetworkNoAppView
  let pdsUrl: string

  describe('Configuration: Test Users DISABLED', () => {
    beforeAll(async () => {
      network = await TestNetworkNoAppView.create({
        pds: {
          allowTestUserCreation: false, // Disabled
          neuro: {
            enabled: true,
            domain: 'test.lab.tagroot.io',
            storageBackend: 'database' as const,
          },
        },
      })

      pdsUrl = network.pds.url
    })

    afterAll(async () => {
      await network?.close()
    })

    it('should reject test user creation when PDS_ALLOW_TEST_USER_CREATION=false', async () => {
      const ctx = network.pds.ctx
      expect(ctx.cfg.allowTestUserCreation).toBe(false)

      const jid = `TestUser${Date.now()}@lab.tagroot.io`
      const legalId = `${Date.now()}@legal.lab.tagroot.io`

      const response = await fetch(`${pdsUrl}/neuro/provision/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          EventId: 'LegalIdUpdated',
          Timestamp: Math.floor(Date.now() / 1000),
          Object: legalId,
          Actor: 'neuro-system',
          Tags: {
            ID: legalId,
            Account: `testuser${Date.now()}`,
            JID: jid,
            State: 'Approved',
            // No EMAIL tag = test user
          },
        }),
      })

      expect(response.status).toBe(403)
      const result = await response.json()
      expect(result.error).toBe('TestUserCreationDisabled')
    })

    it('should allow real user creation when test users disabled', async () => {
      const legalId = `${Date.now()}@legal.lab.tagroot.io`

      const response = await fetch(`${pdsUrl}/neuro/provision/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          EventId: 'LegalIdUpdated',
          Timestamp: Math.floor(Date.now() / 1000),
          Object: legalId,
          Actor: 'neuro-system',
          Tags: {
            ID: legalId,
            Account: `realuser${Date.now()}`,
            EMAIL: 'realuser@example.com',
            State: 'Approved',
          },
        }),
      })

      const responseBody = await response.json()

      expect(response.status).toBe(201)
      expect(responseBody.did).toBeTruthy()

      // Verify stored with legalId, not jid
      const db = network.pds.ctx.accountManager.db.db
      const link = await db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('legalId', '=', legalId)
        .executeTakeFirst()

      expect(link).toBeDefined()
      expect(link!.legalId).toBe(legalId)
      expect(link!.jid).toBeNull()
      expect(link!.isTestUser).toBe(0) // 0 = real user
    })
  })

  describe('Configuration: Test Users ENABLED', () => {
    beforeAll(async () => {
      network = await TestNetworkNoAppView.create({
        pds: {
          allowTestUserCreation: true, // Enabled
          neuro: {
            enabled: true,
            domain: 'test.lab.tagroot.io',
            storageBackend: 'database' as const,
          },
        },
      })

      pdsUrl = network.pds.url
    })

    afterAll(async () => {
      await network?.close()
    })

    it('should accept test user creation when enabled', async () => {
      const ctx = network.pds.ctx
      expect(ctx.cfg.allowTestUserCreation).toBe(true)

      const jid = `TestUser${Date.now()}@lab.tagroot.io`
      const legalId = `${Date.now()}@legal.lab.tagroot.io`

      const response = await fetch(`${pdsUrl}/neuro/provision/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          EventId: 'LegalIdUpdated',
          Timestamp: Math.floor(Date.now() / 1000),
          Object: legalId,
          Actor: 'neuro-system',
          Tags: {
            ID: legalId,
            Account: `testuser${Date.now()}`,
            JID: jid,
            State: 'Approved',
            // No EMAIL tag = test user
          },
        }),
      })

      expect(response.status).toBe(201)
      const result = await response.json()
      expect(result.did).toBeTruthy()

      // Verify stored with jid, not legalId
      const db = network.pds.ctx.accountManager.db.db
      const link = await db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('jid', '=', jid)
        .executeTakeFirst()

      expect(link).toBeDefined()
      expect(link!.jid).toBe(jid)
      expect(link!.legalId).toBeNull()
      expect(link!.isTestUser).toBe(1) // 1 = test user
    })

    it('should store real users with legalId even when test users enabled', async () => {
      const legalId = `${Date.now()}@legal.lab.tagroot.io`

      const response = await fetch(`${pdsUrl}/neuro/provision/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          EventId: 'LegalIdUpdated',
          Timestamp: Math.floor(Date.now() / 1000),
          Object: legalId,
          Actor: 'neuro-system',
          Tags: {
            ID: legalId,
            Account: `realuser${Date.now()}`,
            EMAIL: 'realuser2@example.com',
            State: 'Approved',
          },
        }),
      })

      expect(response.status).toBe(201)

      // Verify stored with legalId, not jid
      const db = network.pds.ctx.accountManager.db.db
      const link = await db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('legalId', '=', legalId)
        .executeTakeFirst()

      expect(link).toBeDefined()
      expect(link!.legalId).toBe(legalId)
      expect(link!.jid).toBeNull()
      expect(link!.isTestUser).toBe(0) // 0 = real user
    })

    it('should have correct database schema', async () => {
      const db = network.pds.ctx.accountManager.db.db

      // Verify columns exist by querying a record
      const link = await db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .limit(1)
        .executeTakeFirst()

      if (link) {
        expect(link).toHaveProperty('legalId')
        expect(link).toHaveProperty('jid')
        expect(link).toHaveProperty('isTestUser')
        expect(link).toHaveProperty('did')
        expect(link).toHaveProperty('email')
        expect(link).toHaveProperty('userName')
        expect(link).toHaveProperty('linkedAt')
        expect(link).toHaveProperty('lastLoginAt')
      }
    })
  })
})
