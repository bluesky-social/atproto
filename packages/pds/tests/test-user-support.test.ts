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
          allowTestUserLogin: false, // Disabled
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
      expect(ctx.cfg.allowTestUserLogin).toBe(false)

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
            ID: legalId, // Test users now have Legal ID
            Account: `testuser${Date.now()}`,
            JID: jid,
            State: 'Approved',
            PHONE: '+1555000000',
            COUNTRY: 'US',
            // No EMAIL field = test user
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
            FIRST: 'Real',
            LAST: 'User',
            PNR: '',
            PHONE: '',
            COUNTRY: 'US',
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
          allowTestUserLogin: true, // Enabled
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
      expect(ctx.cfg.allowTestUserLogin).toBe(true)

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
            ID: legalId, // Test users now have Legal ID
            Account: `testuser${Date.now()}`,
            JID: jid,
            State: 'Approved',
            PHONE: '+1555000000',
            COUNTRY: 'US',
            // No EMAIL field = test user
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
            FIRST: 'Real',
            LAST: 'User',
            PNR: '',
            PHONE: '+15551234567',
            COUNTRY: 'US',
            State: 'Approved',
          },
        }),
      })

      expect(response.status).toBe(201)

      // Verify stored with userJid (new schema), not legalId
      const db = network.pds.ctx.accountManager.db.db
      const link = await db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('userJid', '=', legalId)
        .where('isTestUser', '=', 0)
        .executeTakeFirst()

      expect(link).toBeDefined()
      expect(link!.userJid).toBe(legalId)
      expect(link!.testUserJid).toBeNull()
      expect(link!.isTestUser).toBe(0) // 0 = real user
    })

    it('should have correct database schema (new columns)', async () => {
      const db = network.pds.ctx.accountManager.db.db

      // Verify new schema columns exist
      const link = await db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .limit(1)
        .executeTakeFirst()

      if (link) {
        expect(link).toHaveProperty('userJid')
        expect(link).toHaveProperty('testUserJid')
        expect(link).toHaveProperty('isTestUser')
        expect(link).toHaveProperty('did')
        expect(link).toHaveProperty('linkedAt')
        expect(link).toHaveProperty('lastLoginAt')
        // Old columns removed in migration 015
        expect(link).not.toHaveProperty('legalId')
        expect(link).not.toHaveProperty('jid')
        expect(link).not.toHaveProperty('email')
        expect(link).not.toHaveProperty('userName')
      }
    })
  })

  describe('QuickLogin Column Storage', () => {
    it('should store real user in userJid column during QuickLogin', async () => {
      const userJid = `quicklogin_real${Date.now()}@legal.lab.tagroot.io`
      const did = `did:plc:quickloginreal${Date.now()}`

      const db = network.pds.ctx.accountManager.db.db

      // Simulate QuickLogin callback for real user (has EMAIL tag)
      await db
        .insertInto('account')
        .values({
          did,
          handle: `quickloginreal${Date.now()}.test`,
          email: `quickloginreal${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await db
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

      const link = await db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(link).toBeDefined()
      expect(link!.userJid).toBe(userJid)
      expect(link!.testUserJid).toBeNull()
      expect(link!.isTestUser).toBe(0)
    })

    it('should store test user in testUserJid column during QuickLogin', async () => {
      const testUserJid = `QuickLoginTest${Date.now()}@lab.tagroot.io`
      const did = `did:plc:quicklogintest${Date.now()}`

      const db = network.pds.ctx.accountManager.db.db

      // Simulate QuickLogin callback for test user (no EMAIL tag)
      await db
        .insertInto('account')
        .values({
          did,
          handle: `quicklogintest${Date.now()}.test`,
          email: null, // Test users don't have email
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await db
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

      const link = await db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(link).toBeDefined()
      expect(link!.userJid).toBeNull()
      expect(link!.testUserJid).toBe(testUserJid)
      expect(link!.isTestUser).toBe(1)
    })

    it('should find real user by userJid lookup', async () => {
      const userJid = `lookup_real${Date.now()}@legal.io`
      const did = `did:plc:lookupreal${Date.now()}`

      const db = network.pds.ctx.accountManager.db.db

      await db
        .insertInto('account')
        .values({
          did,
          handle: `lookupreal${Date.now()}.test`,
          email: `lookupreal${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await db
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

      // Lookup by userJid (real users only)
      const link = await db
        .selectFrom('neuro_identity_link')
        .select(['did', 'userJid', 'isTestUser'])
        .where('userJid', '=', userJid)
        .where('isTestUser', '=', 0)
        .executeTakeFirst()

      expect(link).toBeDefined()
      expect(link!.did).toBe(did)
      expect(link!.userJid).toBe(userJid)
    })

    it('should find test user by testUserJid lookup', async () => {
      const testUserJid = `LookupTest${Date.now()}@lab.io`
      const did = `did:plc:lookuptest${Date.now()}`

      const db = network.pds.ctx.accountManager.db.db

      await db
        .insertInto('account')
        .values({
          did,
          handle: `lookuptest${Date.now()}.test`,
          email: null,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await db
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

      // Lookup by testUserJid (test users only)
      const link = await db
        .selectFrom('neuro_identity_link')
        .select(['did', 'testUserJid', 'isTestUser'])
        .where('testUserJid', '=', testUserJid)
        .where('isTestUser', '=', 1)
        .executeTakeFirst()

      expect(link).toBeDefined()
      expect(link!.did).toBe(did)
      expect(link!.testUserJid).toBe(testUserJid)
    })

    it('should enforce mutual exclusivity (not both columns)', async () => {
      const did = `did:plc:exclusive${Date.now()}`

      const db = network.pds.ctx.accountManager.db.db

      await db
        .insertInto('account')
        .values({
          did,
          handle: `exclusive${Date.now()}.test`,
          email: `exclusive${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      // Real user: only userJid populated
      await db
        .insertInto('neuro_identity_link')
        .values({
          did,
          userJid: `exclusive${Date.now()}@legal.io`,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      const link = await db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      // Verify only one column populated
      const populatedColumns = [link?.userJid, link?.testUserJid].filter(
        (col) => col !== null,
      )
      expect(populatedColumns).toHaveLength(1)
    })
  })
})
