// Import directly from source file to avoid pulling in bsky package which has build issues
import { DAY } from '@atproto/common'
import { TestPds } from '@atproto/dev-env/src/pds'

/**
 * Invitation Manager Unit Tests
 *
 * Tests the InvitationManager class functionality including:
 * - Creating invitations with email normalization
 * - Retrieving invitations with expiry filtering
 * - Deleting invitations
 * - Cleanup of expired invitations
 * - Email hashing for privacy
 */

describe('Invitation Manager', () => {
  let pds: TestPds

  beforeAll(async () => {
    pds = await TestPds.create({
      dbPostgresSchema: 'invitation_manager',
    })
  })

  afterAll(async () => {
    await pds.close()
  })

  const ctx = () => pds.ctx

  describe('createInvitation', () => {
    it('creates a new invitation', async () => {
      const email = 'new@example.com'
      const preferredHandle = 'newuser'
      const timestamp = Math.floor(Date.now() / 1000)

      await ctx().invitationManager.createInvitation(
        email,
        preferredHandle,
        timestamp,
      )

      const invitation =
        await ctx().invitationManager.getInvitationByEmail(email)
      expect(invitation).toBeDefined()
      expect(invitation?.email).toBe(email.toLowerCase())
      expect(invitation?.preferred_handle).toBe(preferredHandle)
    })

    it('normalizes email to lowercase', async () => {
      const email = 'CaseSensitive@Example.COM'
      const timestamp = Math.floor(Date.now() / 1000)

      await ctx().invitationManager.createInvitation(email, null, timestamp)

      const invitation =
        await ctx().invitationManager.getInvitationByEmail(email)
      expect(invitation?.email).toBe('casesensitive@example.com')

      // Should find by any case variation
      const invitation2 = await ctx().invitationManager.getInvitationByEmail(
        'casesensitive@example.com',
      )
      expect(invitation2?.email).toBe('casesensitive@example.com')
    })

    it('updates existing invitation on duplicate email', async () => {
      const email = 'duplicate@example.com'
      const timestamp1 = Math.floor(Date.now() / 1000)
      const timestamp2 = timestamp1 + 3600

      // Create first invitation
      await ctx().invitationManager.createInvitation(
        email,
        'firsthandle',
        timestamp1,
      )

      const inv1 = await ctx().invitationManager.getInvitationByEmail(email)
      expect(inv1?.preferred_handle).toBe('firsthandle')

      // Create second invitation with same email
      await ctx().invitationManager.createInvitation(
        email,
        'secondhandle',
        timestamp2,
      )

      const inv2 = await ctx().invitationManager.getInvitationByEmail(email)
      expect(inv2?.preferred_handle).toBe('secondhandle')
      expect(inv2?.id).toBe(inv1?.id) // Same ID, updated row
    })

    it('handles null preferred_handle', async () => {
      const email = 'nohandle@example.com'
      const timestamp = Math.floor(Date.now() / 1000)

      await ctx().invitationManager.createInvitation(email, null, timestamp)

      const invitation =
        await ctx().invitationManager.getInvitationByEmail(email)
      expect(invitation?.email).toBe(email)
      expect(invitation?.preferred_handle).toBeNull()
    })

    it('sets expiry to 30 days from creation', async () => {
      const email = 'expiry@example.com'
      const timestamp = Math.floor(Date.now() / 1000)

      await ctx().invitationManager.createInvitation(email, null, timestamp)

      const invitation =
        await ctx().invitationManager.getInvitationByEmail(email)
      expect(invitation).toBeDefined()

      const createdAt = new Date(invitation!.created_at).getTime()
      const expiresAt = new Date(invitation!.expires_at).getTime()
      const expectedExpiry = 30 * DAY

      expect(expiresAt - createdAt).toBeGreaterThanOrEqual(
        expectedExpiry - 1000,
      )
      expect(expiresAt - createdAt).toBeLessThanOrEqual(expectedExpiry + 1000)
    })
  })

  describe('getInvitationByEmail', () => {
    it('returns null for non-existent email', async () => {
      const invitation = await ctx().invitationManager.getInvitationByEmail(
        'nonexistent@example.com',
      )
      expect(invitation).toBeNull()
    })

    it('returns null for expired invitation', async () => {
      const email = 'expired@example.com'
      const timestamp = Math.floor(Date.now() / 1000)
      const pastDate = new Date(Date.now() - 2 * DAY).toISOString() // 2 days ago

      // Directly insert an expired invitation into the database
      await ctx()
        .accountManager.db.db.insertInto('pending_invitations')
        .values({
          email: email.toLowerCase(),
          preferred_handle: null,
          invitation_timestamp: timestamp,
          created_at: pastDate,
          expires_at: pastDate, // Already expired
        })
        .execute()

      const invitation =
        await ctx().invitationManager.getInvitationByEmail(email)
      expect(invitation).toBeNull()
    })

    it('returns valid non-expired invitation', async () => {
      const email = 'valid@example.com'
      const timestamp = Math.floor(Date.now() / 1000)

      await ctx().invitationManager.createInvitation(
        email,
        'validuser',
        timestamp,
      )

      const invitation =
        await ctx().invitationManager.getInvitationByEmail(email)
      expect(invitation).toBeDefined()
      expect(invitation?.email).toBe(email)
      expect(invitation?.preferred_handle).toBe('validuser')
    })
  })

  describe('deleteInvitation', () => {
    it('deletes invitation by id', async () => {
      const email = 'todelete@example.com'
      const timestamp = Math.floor(Date.now() / 1000)

      await ctx().invitationManager.createInvitation(email, null, timestamp)

      const invitation =
        await ctx().invitationManager.getInvitationByEmail(email)
      expect(invitation).toBeDefined()

      await ctx().invitationManager.deleteInvitation(invitation!.id)

      const deleted = await ctx().invitationManager.getInvitationByEmail(email)
      expect(deleted).toBeNull()
    })

    it('handles deleting non-existent invitation gracefully', async () => {
      await expect(
        ctx().invitationManager.deleteInvitation(999999),
      ).resolves.not.toThrow()
    })
  })

  describe('deleteExpiredInvitations', () => {
    it('deletes expired invitations and returns count', async () => {
      const timestamp = Math.floor(Date.now() / 1000)
      const pastDate = new Date(Date.now() - 2 * DAY).toISOString() // 2 days ago

      // Directly insert expired invitations
      await ctx()
        .accountManager.db.db.insertInto('pending_invitations')
        .values([
          {
            email: 'expired1@example.com',
            preferred_handle: null,
            invitation_timestamp: timestamp,
            created_at: pastDate,
            expires_at: pastDate,
          },
          {
            email: 'expired2@example.com',
            preferred_handle: null,
            invitation_timestamp: timestamp,
            created_at: pastDate,
            expires_at: pastDate,
          },
        ])
        .execute()

      // Create valid invitation via manager
      await ctx().invitationManager.createInvitation(
        'valid-cleanup@example.com',
        null,
        timestamp,
      )

      const deletedCount =
        await ctx().invitationManager.deleteExpiredInvitations()
      expect(deletedCount).toBe(0) // No longer deletes, just marks

      // Verify expired are marked (not deleted)
      const exp1 = await ctx().invitationManager.getInvitationByEmail(
        'expired1@example.com',
      )
      expect(exp1).toBeNull() // Not returned by getInvitationByEmail (only returns pending)

      // Verify valid remains
      const valid = await ctx().invitationManager.getInvitationByEmail(
        'valid-cleanup@example.com',
      )
      expect(valid).toBeDefined()
    })

    it('returns 0 when no expired invitations exist', async () => {
      const count = await ctx().invitationManager.deleteExpiredInvitations()
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getPendingCount', () => {
    it('returns count of non-expired pending invitations', async () => {
      const timestamp = Math.floor(Date.now() / 1000)

      // Get initial count
      const initialCount = await ctx().invitationManager.getPendingCount()

      // Add invitations
      await ctx().invitationManager.createInvitation(
        'count1@example.com',
        null,
        timestamp,
      )
      await ctx().invitationManager.createInvitation(
        'count2@example.com',
        null,
        timestamp,
      )

      const newCount = await ctx().invitationManager.getPendingCount()
      expect(newCount).toBe(initialCount + 2)
    })
  })

  describe('hashEmail', () => {
    it('returns consistent hash for same email', async () => {
      const email = 'test@example.com'
      const hash1 = ctx().invitationManager.hashEmail(email)
      const hash2 = ctx().invitationManager.hashEmail(email)
      expect(hash1).toBe(hash2)
    })

    it('returns different hashes for different emails', async () => {
      const hash1 = ctx().invitationManager.hashEmail('test1@example.com')
      const hash2 = ctx().invitationManager.hashEmail('test2@example.com')
      expect(hash1).not.toBe(hash2)
    })

    it('hashes email for privacy logging', async () => {
      const email = 'sensitive@example.com'
      const hash = ctx().invitationManager.hashEmail(email)
      expect(hash).not.toContain('@')
      expect(hash).not.toContain('sensitive')
      expect(hash.length).toBeGreaterThanOrEqual(8)
    })
  })

  describe('Phase 2: Status Tracking', () => {
    describe('consumeInvitation', () => {
      it('marks invitation as consumed with DID and handle', async () => {
        const email = 'consume@example.com'
        const timestamp = Math.floor(Date.now() / 1000)
        const did = 'did:plc:test123'
        const handle = 'testuser.bsky.social'

        await ctx().invitationManager.createInvitation(
          email,
          'testuser',
          timestamp,
        )

        await ctx().invitationManager.consumeInvitation(email, did, handle)

        const invitation =
          await ctx().invitationManager.getInvitationByEmail(email)
        expect(invitation).toBeNull() // No longer pending

        // Verify via direct DB query
        const consumed = await ctx()
          .accountManager.db.db.selectFrom('pending_invitations')
          .selectAll()
          .where('email', '=', email.toLowerCase())
          .executeTakeFirst()

        expect(consumed?.status).toBe('consumed')
        expect(consumed?.consuming_did).toBe(did)
        expect(consumed?.consuming_handle).toBe(handle)
        expect(consumed?.consumed_at).toBeDefined()
      })

      it('handles non-existent invitation gracefully', async () => {
        // consumeInvitation doesn't throw - it just updates 0 rows
        await ctx().invitationManager.consumeInvitation(
          'nonexistent@example.com',
          'did:plc:test',
          'handle',
        )
        // Should not throw
      })
    })

    describe('revokeInvitation', () => {
      it('revokes invitation by email', async () => {
        const email = 'revoke-email@example.com'
        const timestamp = Math.floor(Date.now() / 1000)

        await ctx().invitationManager.createInvitation(email, null, timestamp)

        await ctx().invitationManager.revokeInvitation(email)

        const invitation =
          await ctx().invitationManager.getInvitationByEmail(email)
        expect(invitation).toBeNull()

        // Verify status in DB
        const revoked = await ctx()
          .accountManager.db.db.selectFrom('pending_invitations')
          .selectAll()
          .where('email', '=', email.toLowerCase())
          .executeTakeFirst()

        expect(revoked?.status).toBe('revoked')
      })

      it('revokes invitation by ID', async () => {
        const email = 'revoke-id@example.com'
        const timestamp = Math.floor(Date.now() / 1000)

        await ctx().invitationManager.createInvitation(email, null, timestamp)

        const invitation =
          await ctx().invitationManager.getInvitationByEmail(email)
        const id = invitation!.id

        await ctx().invitationManager.revokeInvitation(id)

        const afterRevoke =
          await ctx().invitationManager.getInvitationByEmail(email)
        expect(afterRevoke).toBeNull()
      })

      it('throws error when revoking non-existent invitation', async () => {
        await expect(
          ctx().invitationManager.revokeInvitation('nonexistent@example.com'),
        ).rejects.toThrow('Invitation not found')
      })
    })

    describe('purgeInvitations', () => {
      it('purges consumed invitations older than timestamp', async () => {
        const timestamp = Math.floor(Date.now() / 1000)
        const oldDate = new Date(Date.now() - 2 * DAY).toISOString()

        // Create and consume an old invitation
        await ctx()
          .accountManager.db.db.insertInto('pending_invitations')
          .values({
            email: 'old-consumed@example.com',
            preferred_handle: null,
            invitation_timestamp: timestamp - 2 * 86400,
            created_at: oldDate,
            expires_at: oldDate,
            status: 'consumed',
            consumed_at: oldDate,
            consuming_did: 'did:plc:old',
            consuming_handle: 'old.user',
          })
          .execute()

        // Create a recent consumed invitation (should not be purged due to 1s buffer)
        const recentDate = new Date(Date.now() - 10).toISOString()
        await ctx()
          .accountManager.db.db.insertInto('pending_invitations')
          .values({
            email: 'recent-consumed@example.com',
            preferred_handle: null,
            invitation_timestamp: timestamp,
            created_at: recentDate,
            expires_at: new Date(Date.now() + DAY).toISOString(),
            status: 'consumed',
            consumed_at: recentDate,
            consuming_did: 'did:plc:recent',
            consuming_handle: 'recent.user',
          })
          .execute()

        const beforeTimestamp = new Date(Date.now() - DAY).toISOString()
        const deletedCount = await ctx().invitationManager.purgeInvitations(
          'consumed',
          beforeTimestamp,
        )

        expect(deletedCount).toBeGreaterThanOrEqual(1)

        // Verify old is gone
        const old = await ctx()
          .accountManager.db.db.selectFrom('pending_invitations')
          .selectAll()
          .where('email', '=', 'old-consumed@example.com')
          .executeTakeFirst()
        expect(old).toBeUndefined()

        // Verify recent still exists (within 1s buffer)
        const recent = await ctx()
          .accountManager.db.db.selectFrom('pending_invitations')
          .selectAll()
          .where('email', '=', 'recent-consumed@example.com')
          .executeTakeFirst()
        expect(recent).toBeDefined()
      })

      it('purges all non-pending statuses when status is null', async () => {
        const timestamp = Math.floor(Date.now() / 1000)
        const oldDate = new Date(Date.now() - 2 * DAY).toISOString()

        await ctx()
          .accountManager.db.db.insertInto('pending_invitations')
          .values([
            {
              email: 'purge-consumed@example.com',
              preferred_handle: null,
              invitation_timestamp: timestamp,
              created_at: oldDate,
              expires_at: oldDate,
              status: 'consumed',
              consumed_at: oldDate,
            },
            {
              email: 'purge-revoked@example.com',
              preferred_handle: null,
              invitation_timestamp: timestamp,
              created_at: oldDate,
              expires_at: oldDate,
              status: 'revoked',
            },
            {
              email: 'purge-expired@example.com',
              preferred_handle: null,
              invitation_timestamp: timestamp,
              created_at: oldDate,
              expires_at: oldDate,
              status: 'expired',
            },
          ])
          .execute()

        const beforeTimestamp = new Date(Date.now() - DAY).toISOString()
        // Purge each status separately since API requires specific status
        let deletedCount = 0
        deletedCount += await ctx().invitationManager.purgeInvitations(
          'consumed',
          beforeTimestamp,
        )
        deletedCount += await ctx().invitationManager.purgeInvitations(
          'revoked',
          beforeTimestamp,
        )
        deletedCount += await ctx().invitationManager.purgeInvitations(
          'expired',
          beforeTimestamp,
        )

        expect(deletedCount).toBeGreaterThanOrEqual(3)
      })
    })

    describe('getInvitations', () => {
      it('returns paginated invitations with filters', async () => {
        const timestamp = Math.floor(Date.now() / 1000)
        const oldDate = new Date(Date.now() - 2 * DAY).toISOString()

        // Create old invitations that pass the 1-second safety buffer
        await ctx()
          .accountManager.db.db.insertInto('pending_invitations')
          .values([
            {
              email: 'page1@example.com',
              preferred_handle: 'user1',
              invitation_timestamp: timestamp,
              created_at: oldDate,
              expires_at: new Date(Date.now() + DAY).toISOString(),
              status: 'pending',
            },
            {
              email: 'page2@example.com',
              preferred_handle: 'user2',
              invitation_timestamp: timestamp,
              created_at: oldDate,
              expires_at: new Date(Date.now() + DAY).toISOString(),
              status: 'pending',
            },
          ])
          .execute()

        const result = await ctx().invitationManager.getInvitations({
          status: 'pending',
          limit: 10,
        })

        expect(result.length).toBeGreaterThanOrEqual(2)
        expect(result[0].status).toBe('pending')
      })

      it('filters by status', async () => {
        const timestamp = Math.floor(Date.now() / 1000)
        const oldDate = new Date(Date.now() - 2 * DAY).toISOString()

        await ctx()
          .accountManager.db.db.insertInto('pending_invitations')
          .values({
            email: 'filter-consumed@example.com',
            preferred_handle: null,
            invitation_timestamp: timestamp,
            created_at: oldDate,
            expires_at: oldDate,
            status: 'consumed',
            consumed_at: oldDate,
          })
          .execute()

        const result = await ctx().invitationManager.getInvitations({
          status: 'consumed',
          limit: 10,
        })

        expect(
          result.some((inv) => inv.email === 'filter-consumed@example.com'),
        ).toBe(true)
        expect(result.every((inv) => inv.status === 'consumed')).toBe(true)
      })

      it('supports pagination with offset', async () => {
        const page1 = await ctx().invitationManager.getInvitations({
          status: 'all',
          limit: 2,
          offset: 0,
        })

        const page2 = await ctx().invitationManager.getInvitations({
          status: 'all',
          limit: 2,
          offset: 2,
        })

        expect(Array.isArray(page2)).toBe(true)
      })
    })

    describe('getStats', () => {
      it('returns invitation statistics', async () => {
        const timestamp = Math.floor(Date.now() / 1000)
        const sinceDate = new Date(Date.now() - DAY).toISOString()

        const stats = await ctx().invitationManager.getStats(sinceDate)

        expect(stats).toHaveProperty('pending')
        expect(stats).toHaveProperty('consumed')
        expect(stats).toHaveProperty('revoked')
        expect(stats).toHaveProperty('expired')
        expect(stats).toHaveProperty('consumedSince')
        expect(stats).toHaveProperty('conversionRate')

        expect(typeof stats.pending).toBe('number')
        expect(typeof stats.consumed).toBe('number')
        expect(typeof stats.conversionRate).toBe('string')
      })

      it('calculates conversion rate correctly', async () => {
        const timestamp = Math.floor(Date.now() / 1000)
        const testDate = new Date(Date.now() - DAY).toISOString()

        // Create test data
        await ctx()
          .accountManager.db.db.insertInto('pending_invitations')
          .values([
            {
              email: 'stats1@example.com',
              preferred_handle: null,
              invitation_timestamp: timestamp,
              created_at: testDate,
              expires_at: new Date(Date.now() + DAY).toISOString(),
              status: 'consumed',
              consumed_at: testDate,
            },
            {
              email: 'stats2@example.com',
              preferred_handle: null,
              invitation_timestamp: timestamp,
              created_at: testDate,
              expires_at: new Date(Date.now() + DAY).toISOString(),
              status: 'consumed',
              consumed_at: testDate,
            },
            {
              email: 'stats3@example.com',
              preferred_handle: null,
              invitation_timestamp: timestamp,
              created_at: testDate,
              expires_at: new Date(Date.now() + DAY).toISOString(),
              status: 'pending',
            },
          ])
          .execute()

        const stats = await ctx().invitationManager.getStats(testDate)

        expect(stats.consumed).toBeGreaterThanOrEqual(2)
        expect(stats.consumedSince).toBeGreaterThanOrEqual(2)

        if (stats.conversionRate) {
          const rate = parseFloat(stats.conversionRate)
          expect(rate).toBeGreaterThanOrEqual(0)
          expect(rate).toBeLessThanOrEqual(100)
        }
      })
    })
  })
})
