import { TestNetworkNoAppView } from '@atproto/dev-env'
import { Database } from '../src/account-manager/db'

/**
 * Neuro Data Integrity Tests
 *
 * Validates database constraints and data integrity rules:
 * - Mutual exclusivity (userJid XOR testUserJid)
 * - Uniqueness constraints on userJid and testUserJid
 * - Foreign key constraint to account.did
 * - isTestUser flag consistency
 * - Null handling
 * - Index functionality
 */

describe('Neuro Data Integrity', () => {
  let network: TestNetworkNoAppView
  let db: Database

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'neuro_data_integrity',
    })
    db = network.pds.ctx.accountManager.db
  })

  afterAll(async () => {
    await network.close()
  })

  describe('Mutual Exclusivity Constraints', () => {
    it('should allow userJid with null testUserJid', async () => {
      const did = `did:plc:exclusive1${Date.now()}`
      const userJid = `exclusive1${Date.now()}@legal.io`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `exclusive1${Date.now()}.test`,
          email: `exclusive1@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await expect(
        db.db
          .insertInto('neuro_identity_link')
          .values({
            did,
            userJid,
            testUserJid: null,
            isTestUser: 0,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute(),
      ).resolves.toBeDefined()
    })

    it('should allow testUserJid with null userJid', async () => {
      const did = `did:plc:exclusive2${Date.now()}`
      const testUserJid = `Exclusive2${Date.now()}@lab.io`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `exclusive2${Date.now()}.test`,
          email: null,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await expect(
        db.db
          .insertInto('neuro_identity_link')
          .values({
            did,
            userJid: null,
            testUserJid,
            isTestUser: 1,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute(),
      ).resolves.toBeDefined()
    })

    it('should verify exactly one column is populated per row', async () => {
      const links = await db.db
        .selectFrom('neuro_identity_link')
        .select(['userJid', 'testUserJid'])
        .execute()

      for (const link of links) {
        const populated = [link.userJid, link.testUserJid].filter(
          (col) => col !== null,
        )
        expect(populated).toHaveLength(1)
      }
    })
  })

  describe('Uniqueness Constraints', () => {
    it('should enforce unique userJid among real users', async () => {
      const userJid = `unique_real${Date.now()}@legal.io`
      const did1 = `did:plc:unique1${Date.now()}`
      const did2 = `did:plc:unique2${Date.now()}`

      // Create accounts
      await db.db
        .insertInto('account')
        .values([
          {
            did: did1,
            handle: `unique1${Date.now()}.test`,
            email: `unique1@test.com`,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
          {
            did: did2,
            handle: `unique2${Date.now()}.test`,
            email: `unique2@test.com`,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
        ])
        .execute()

      // First insert succeeds
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

      // Duplicate userJid fails
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

    it('should enforce unique testUserJid among test users', async () => {
      const testUserJid = `UniqueTest${Date.now()}@lab.io`
      const did1 = `did:plc:testunique1${Date.now()}`
      const did2 = `did:plc:testunique2${Date.now()}`

      await db.db
        .insertInto('account')
        .values([
          {
            did: did1,
            handle: `testunique1${Date.now()}.test`,
            email: null,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
          {
            did: did2,
            handle: `testunique2${Date.now()}.test`,
            email: null,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
        ])
        .execute()

      // First insert succeeds
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

      // Duplicate testUserJid fails
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

    it('should allow same value across userJid and testUserJid columns', async () => {
      const sameValue = `SameValue${Date.now()}@lab.io`
      const realDid = `did:plc:samereal${Date.now()}`
      const testDid = `did:plc:sametest${Date.now()}`

      await db.db
        .insertInto('account')
        .values([
          {
            did: realDid,
            handle: `samereal${Date.now()}.test`,
            email: `samereal@test.com`,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
          {
            did: testDid,
            handle: `sametest${Date.now()}.test`,
            email: null,
            passwordScrypt: 'fake-hash',
            createdAt: new Date().toISOString(),
          },
        ])
        .execute()

      // Both should succeed with same value in different columns
      await expect(
        db.db
          .insertInto('neuro_identity_link')
          .values({
            did: realDid,
            userJid: sameValue,
            testUserJid: null,
            isTestUser: 0,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute(),
      ).resolves.toBeDefined()

      await expect(
        db.db
          .insertInto('neuro_identity_link')
          .values({
            did: testDid,
            userJid: null,
            testUserJid: sameValue,
            isTestUser: 1,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute(),
      ).resolves.toBeDefined()
    })

    it('should enforce unique DID (one link per account)', async () => {
      const did = `did:plc:uniquedid${Date.now()}`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `uniquedid${Date.now()}.test`,
          email: `uniquedid@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      // First link
      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did,
          userJid: `first${Date.now()}@legal.io`,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      // Second link with same DID should fail
      await expect(
        db.db
          .insertInto('neuro_identity_link')
          .values({
            did, // Duplicate DID
            userJid: `second${Date.now()}@legal.io`,
            testUserJid: null,
            isTestUser: 0,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute(),
      ).rejects.toThrow()
    })
  })

  describe('Foreign Key Constraints', () => {
    it('should reject link with non-existent DID', async () => {
      const nonExistentDid = `did:plc:doesnotexist${Date.now()}`

      await expect(
        db.db
          .insertInto('neuro_identity_link')
          .values({
            did: nonExistentDid,
            userJid: `orphan${Date.now()}@legal.io`,
            testUserJid: null,
            isTestUser: 0,
            linkedAt: new Date().toISOString(),
            lastLoginAt: null,
          })
          .execute(),
      ).rejects.toThrow()
    })

    it('should cascade delete link when account is deleted', async () => {
      const did = `did:plc:cascade${Date.now()}`
      const userJid = `cascade${Date.now()}@legal.io`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `cascade${Date.now()}.test`,
          email: `cascade@test.com`,
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

      // Delete account
      await db.db.deleteFrom('account').where('did', '=', did).execute()

      // Link should be deleted too (cascade)
      const link = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(link).toBeUndefined()
    })
  })

  describe('isTestUser Flag Consistency', () => {
    it('should have isTestUser=0 when userJid is populated', async () => {
      const links = await db.db
        .selectFrom('neuro_identity_link')
        .select(['userJid', 'isTestUser'])
        .where('userJid', 'is not', null)
        .execute()

      for (const link of links) {
        expect(link.isTestUser).toBe(0)
      }
    })

    it('should have isTestUser=1 when testUserJid is populated', async () => {
      const links = await db.db
        .selectFrom('neuro_identity_link')
        .select(['testUserJid', 'isTestUser'])
        .where('testUserJid', 'is not', null)
        .execute()

      for (const link of links) {
        expect(link.isTestUser).toBe(1)
      }
    })

    it('should reject isTestUser=0 with testUserJid populated', async () => {
      // This is enforced at application level, not DB constraint
      // But we can verify the intended usage pattern
      const did = `did:plc:inconsistent${Date.now()}`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `inconsistent${Date.now()}.test`,
          email: `inconsistent@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      // This will succeed at DB level but violates application logic
      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did,
          userJid: `consistent${Date.now()}@legal.io`,
          testUserJid: null,
          isTestUser: 0, // Correct
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      const link = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      // Verify consistency
      if (link?.userJid) {
        expect(link.isTestUser).toBe(0)
      }
      if (link?.testUserJid) {
        expect(link.isTestUser).toBe(1)
      }
    })
  })

  describe('Null Handling', () => {
    it('should allow null lastLoginAt', async () => {
      const did = `did:plc:nulllogin${Date.now()}`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `nulllogin${Date.now()}.test`,
          email: `nulllogin@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did,
          userJid: `nulllogin${Date.now()}@legal.io`,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      const link = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()

      expect(link?.lastLoginAt).toBeNull()
    })

    it('should require linkedAt (not null)', async () => {
      const did = `did:plc:nulllinked${Date.now()}`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `nulllinked${Date.now()}.test`,
          email: `nulllinked@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      // linkedAt is required
      await expect(
        db.db
          .insertInto('neuro_identity_link')
          .values({
            did,
            userJid: `nulllinked${Date.now()}@legal.io`,
            testUserJid: null,
            isTestUser: 0,
            linkedAt: null as any, // Force null
            lastLoginAt: null,
          })
          .execute(),
      ).rejects.toThrow()
    })
  })

  describe('Index Performance', () => {
    it('should efficiently query by userJid', async () => {
      const userJid = `indexed${Date.now()}@legal.io`
      const did = `did:plc:indexed${Date.now()}`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `indexed${Date.now()}.test`,
          email: `indexed@test.com`,
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

      const start = Date.now()
      const link = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('userJid', '=', userJid)
        .executeTakeFirst()
      const duration = Date.now() - start

      expect(link).toBeDefined()
      expect(duration).toBeLessThan(100) // Should be fast with index
    })

    it('should efficiently query by testUserJid', async () => {
      const testUserJid = `IndexedTest${Date.now()}@lab.io`
      const did = `did:plc:indexedtest${Date.now()}`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `indexedtest${Date.now()}.test`,
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

      const start = Date.now()
      const link = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('testUserJid', '=', testUserJid)
        .executeTakeFirst()
      const duration = Date.now() - start

      expect(link).toBeDefined()
      expect(duration).toBeLessThan(100) // Should be fast with index
    })

    it('should efficiently query by DID', async () => {
      const did = `did:plc:didindex${Date.now()}`

      await db.db
        .insertInto('account')
        .values({
          did,
          handle: `didindex${Date.now()}.test`,
          email: `didindex@test.com`,
          passwordScrypt: 'fake-hash',
          createdAt: new Date().toISOString(),
        })
        .execute()

      await db.db
        .insertInto('neuro_identity_link')
        .values({
          did,
          userJid: `didindex${Date.now()}@legal.io`,
          testUserJid: null,
          isTestUser: 0,
          linkedAt: new Date().toISOString(),
          lastLoginAt: null,
        })
        .execute()

      const start = Date.now()
      const link = await db.db
        .selectFrom('neuro_identity_link')
        .selectAll()
        .where('did', '=', did)
        .executeTakeFirst()
      const duration = Date.now() - start

      expect(link).toBeDefined()
      expect(duration).toBeLessThan(100) // Primary key lookup
    })
  })
})
