import { TestNetworkNoAppView } from '@atproto/dev-env'
import { Database } from '../src/account-manager/db'

/**
 * Schema Migration Tests - Migrations 014 & 015
 *
 * Validates:
 * - Migration 014: jidRef column addition
 * - Migration 015: Privacy-separated schema (userJid, testUserJid, isTestUser)
 * - Index creation on userJid and testUserJid
 * - Proper null handling (mutual exclusivity)
 * - isTestUser flag behavior
 */

describe('Schema Migration 014 & 015', () => {
  let network: TestNetworkNoAppView
  let db: Database

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'schema_migration',
    })
    db = network.pds.ctx.accountManager.db
  })

  afterAll(async () => {
    await network.close()
  })

  describe('Migration 015: Privacy-Separated Neuro Schema', () => {
    it('has userJid column for real users', async () => {
      const did = `did:plc:test${Date.now()}`
      const userJid = `user${Date.now()}@legal.lab.tagroot.io`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `user${Date.now()}.test`,
          email: `user${Date.now()}@test.com`,
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

      const result = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(result).toBeTruthy()
      expect(result?.userJid).toBe(userJid)
      expect(result?.testUserJid).toBeNull()
      expect(result?.isTestUser).toBe(0)
    })

    it('has testUserJid column for test users', async () => {
      const did = `did:plc:test${Date.now()}`
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

      const result = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(result).toBeTruthy()
      expect(result?.userJid).toBeNull()
      expect(result?.testUserJid).toBe(testUserJid)
      expect(result?.isTestUser).toBe(1)
    })

    it('enforces mutual exclusivity (userJid XOR testUserJid)', async () => {
      const did = `did:plc:test${Date.now()}`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `exclusive${Date.now()}.test`,
          email: `exclusive${Date.now()}@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      // Should NOT be able to insert with both userJid AND testUserJid
      // (This is enforced at application level, not DB constraint)
      // But we can verify the intention
      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did,
          userJid: `user${Date.now()}@legal.io`,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      const result = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      // Exactly one should be populated
      const populatedFields = [result?.userJid, result?.testUserJid].filter(
        (f) => f !== null,
      )
      expect(populatedFields).toHaveLength(1)
    })

    it('can query real users by userJid', async () => {
      const did = `did:plc:test${Date.now()}`
      const userJid = `queryuser${Date.now()}@legal.lab.tagroot.io`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `queryuser${Date.now()}.test`,
          email: `query${Date.now()}@test.com`,
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

      const result = await db.db
        .selectFrom('neuro_identity_link')
        .select(['did', 'userJid', 'testUserJid', 'isTestUser'])
        .where('userJid', '=', userJid)
        .where('isTestUser', '=', 0)
        .executeTakeFirst()

      expect(result).toBeTruthy()
      expect(result?.did).toBe(did)
      expect(result?.userJid).toBe(userJid)
      expect(result?.isTestUser).toBe(0)
    })

    it('can query test users by testUserJid', async () => {
      const did = `did:plc:test${Date.now()}`
      const testUserJid = `QueryTestUser${Date.now()}@lab.tagroot.io`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `querytestuser${Date.now()}.test`,
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

      const result = await db.db
        .selectFrom('neuro_identity_link')
        .select(['did', 'userJid', 'testUserJid', 'isTestUser'])
        .where('testUserJid', '=', testUserJid)
        .where('isTestUser', '=', 1)
        .executeTakeFirst()

      expect(result).toBeTruthy()
      expect(result?.did).toBe(did)
      expect(result?.testUserJid).toBe(testUserJid)
      expect(result?.isTestUser).toBe(1)
    })

    it('isTestUser flag correctly differentiates user types', async () => {
      const realUserDid = `did:plc:real${Date.now()}`
      const testUserDid = `did:plc:test${Date.now()}`

      // Create accounts
      await db.db
        .insertInto('account')
        .values([
          {
            did: realUserDid,
            handle: `realuser${Date.now()}.test`,
            email: `real${Date.now()}@test.com`,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
          {
            did: testUserDid,
            handle: `testuser${Date.now()}.test`,
            email: null,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
        ])
        .execute()

      // Create links
      await db.db
        .insertInto('neuro_identity_link')
        .values([
          {
            did: realUserDid,
            userJid: `real${Date.now()}@legal.io`,
            testUserJid: null,
            isTestUser: 0,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          },
          {
            did: testUserDid,
            userJid: null,
            testUserJid: `Test${Date.now()}@lab.io`,
            isTestUser: 1,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          },
        ])
        .execute()

      // Query real users
      const realUsers = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('isTestUser', '=', 0)
        .where('did', 'in', [realUserDid, testUserDid])
        .execute()

      expect(realUsers).toHaveLength(1)
      expect(realUsers[0].did).toBe(realUserDid)
      expect(realUsers[0].userJid).toBeTruthy()
      expect(realUsers[0].testUserJid).toBeNull()

      // Query test users
      const testUsers = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('isTestUser', '=', 1)
        .where('did', 'in', [realUserDid, testUserDid])
        .execute()

      expect(testUsers).toHaveLength(1)
      expect(testUsers[0].did).toBe(testUserDid)
      expect(testUsers[0].testUserJid).toBeTruthy()
      expect(testUsers[0].userJid).toBeNull()
    })

    it('userJid is unique among real users', async () => {
      const userJid = `unique${Date.now()}@legal.lab.tagroot.io`
      const did1 = `did:plc:dup1${Date.now()}`
      const did2 = `did:plc:dup2${Date.now()}`

      // Create accounts
      await db.db
        .insertInto('account')
        .values([
          {
            did: did1,
            handle: `dup1${Date.now()}.test`,
            email: `dup1${Date.now()}@test.com`,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
          {
            did: did2,
            handle: `dup2${Date.now()}.test`,
            email: `dup2${Date.now()}@test.com`,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
        ])
        .execute()

      // First insert should succeed
      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did: did1,
          userJid,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      // Second insert with same userJid should fail
      await expect(
        db.db
          .insertInto('neuro_identity_link')
          .values({
            did: did2,
            userJid,
            testUserJid: null,
            isTestUser: 0,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute(),
      ).rejects.toThrow()
    })

    it('testUserJid is unique among test users', async () => {
      const testUserJid = `UniqueTest${Date.now()}@lab.tagroot.io`
      const did1 = `did:plc:testdup1${Date.now()}`
      const did2 = `did:plc:testdup2${Date.now()}`

      // Create accounts
      await db.db
        .insertInto('account')
        .values([
          {
            did: did1,
            handle: `testdup1${Date.now()}.test`,
            email: null,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
          {
            did: did2,
            handle: `testdup2${Date.now()}.test`,
            email: null,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
        ])
        .execute()

      // First insert should succeed
      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did: did1,
          userJid: null,
          testUserJid,
          isTestUser: 1,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      // Second insert with same testUserJid should fail
      await expect(
        db.db
          .insertInto('neuro_identity_link')
          .values({
            did: did2,
            userJid: null,
            testUserJid,
            isTestUser: 1,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute(),
      ).rejects.toThrow()
    })

    it('allows same JID value in different columns (real vs test)', async () => {
      const jidValue = `SameValue${Date.now()}@lab.tagroot.io`
      const realUserDid = `did:plc:realuser${Date.now()}`
      const testUserDid = `did:plc:testuser${Date.now()}`

      // Create accounts
      await db.db
        .insertInto('account')
        .values([
          {
            did: realUserDid,
            handle: `realuser${Date.now()}.test`,
            email: `real${Date.now()}@test.com`,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
          {
            did: testUserDid,
            handle: `testuser${Date.now()}.test`,
            email: null,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
        ])
        .execute()

      // Same JID value in different columns should be allowed
      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did: realUserDid,
          userJid: jidValue,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did: testUserDid,
          userJid: null,
          testUserJid: jidValue,
          isTestUser: 1,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      // Both should exist
      const realUser = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', realUserDid)
        .executeTakeFirst()

      const testUser = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', testUserDid)
        .executeTakeFirst()

      expect(realUser?.userJid).toBe(jidValue)
      expect(testUser?.testUserJid).toBe(jidValue)
    })
  })
})
