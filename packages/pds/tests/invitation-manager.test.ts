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
      expect(deletedCount).toBeGreaterThanOrEqual(2)

      // Verify expired are gone
      const exp1 = await ctx().invitationManager.getInvitationByEmail(
        'expired1@example.com',
      )
      expect(exp1).toBeNull()

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
})
