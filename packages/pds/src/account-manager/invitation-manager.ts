import { createHmac } from 'node:crypto'
import { DAY } from '@atproto/common'
import { dbLogger } from '../logger'
import { AccountDb } from './db'
import { PendingInvitationEntry } from './db/schema'

const INVITATION_EXPIRY_MS = 30 * DAY // 30 days

export class InvitationManager {
  constructor(
    public db: AccountDb,
    private emailHashSalt: string | null = null,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  private normalizeHash(hash: string): string {
    return hash.trim().toLowerCase()
  }

  private ensureInvitationHashSaltConfigured(): void {
    if (!this.emailHashSalt) {
      throw new Error(
        'PDS_INVITATION_EMAIL_HASH_SALT is not set. Invitation creation is disabled until it is configured.',
      )
    }
  }

  /**
   * Create a new invitation or update existing one
   * Email is normalized to lowercase for consistency
   */
  async createInvitation(
    email: string,
    preferredHandle?: string | null,
    invitationTimestamp?: number,
  ): Promise<void> {
    this.ensureInvitationHashSaltConfigured()

    const normalizedEmail = this.normalizeEmail(email)
    const emailHash = this.hashEmail(normalizedEmail)
    const now = new Date().toISOString()
    const timestamp = invitationTimestamp || Math.floor(Date.now() / 1000)
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS).toISOString()

    dbLogger.info(
      {
        emailHash: this.hashEmail(normalizedEmail),
        hasPreferredHandle: !!preferredHandle,
      },
      'Creating invitation',
    )

    // Use INSERT OR REPLACE to handle duplicates
    await this.db.db
      .insertInto('pending_invitations')
      .values({
        email: normalizedEmail,
        email_hash: emailHash,
        preferred_handle: preferredHandle || null,
        invitation_timestamp: timestamp,
        created_at: now,
        expires_at: expiresAt,
        status: 'pending',
        email_attempt_count: 0,
      })
      .onConflict((oc) =>
        oc.column('email').doUpdateSet({
          email_hash: emailHash,
          preferred_handle: preferredHandle || null,
          invitation_timestamp: timestamp,
          created_at: now,
          expires_at: expiresAt,
          status: 'pending',
          email_attempt_count: 0,
        }),
      )
      .execute()
  }

  /**
   * Get invitation by email (case-insensitive)
   * Returns null if not found, expired, or not pending
   */
  async getInvitationByEmail(
    email: string,
  ): Promise<PendingInvitationEntry | null> {
    const normalizedEmail = this.normalizeEmail(email)
    const emailHash = this.hashEmail(normalizedEmail)
    const now = new Date().toISOString()

    const invitation = await this.db.db
      .selectFrom('pending_invitations')
      .selectAll()
      .where((qb) =>
        qb
          .where('email_hash', '=', emailHash)
          .orWhere('email', '=', normalizedEmail),
      )
      .where('status', '=', 'pending')
      .where('expires_at', '>', now)
      .executeTakeFirst()

    return invitation || null
  }

  async getInvitationByEmailHash(
    emailHash: string,
  ): Promise<PendingInvitationEntry | null> {
    const normalizedHash = this.normalizeHash(emailHash)
    const now = new Date().toISOString()

    const invitation = await this.db.db
      .selectFrom('pending_invitations')
      .selectAll()
      .where('email_hash', '=', normalizedHash)
      .where('status', '=', 'pending')
      .where('expires_at', '>', now)
      .executeTakeFirst()

    return invitation || null
  }

  /**
   * Get invitation by JID
   * Returns null if not found or not in valid status
   *
   * NOTE: Compares only the UUID portion (local part before @)
   * since CreatedAccounts.json doesn't include domain information.
   * Received JID: f0d860cc-60c0-4260-b54f-782c9d9a749f@auth-dev.widentity.dev
   * Stored JID:   f0d860cc-60c0-4260-b54f-782c9d9a749f
   * Comparison:   f0d860cc-60c0-4260-b54f-782c9d9a749f (extract local part)
   */
  async getInvitationByJid(
    jid: string,
  ): Promise<PendingInvitationEntry | null> {
    const now = new Date().toISOString()

    // Extract just the UUID portion (local part before @)
    const jidLocalPart = jid.split('@')[0]

    // Fetch all active invitations (status and expiry check)
    const invitations = await this.db.db
      .selectFrom('pending_invitations')
      .selectAll()
      .where('status', 'in', [
        'pending',
        'email_pending',
        'email_sent',
        'email_failed',
      ])
      .where('expires_at', '>', now)
      .where('jid', 'is not', null)
      .execute()

    // Find matching invitation by UUID comparison
    const invitation = invitations.find((inv) => {
      if (!inv.jid) return false

      const storedLocalPart = inv.jid.split('@')[0]

      return storedLocalPart === jidLocalPart
    })

    return invitation || null
  }

  /**
   * Get active invitation by email hash (for create-or-reuse flow)
   * Returns row with JID if it exists and is reusable.
   * Only returns invitations with at least 7 days of remaining lifetime.
   */
  async getActiveInvitationByEmailHash(
    emailHash: string,
  ): Promise<PendingInvitationEntry | null> {
    const normalizedHash = this.normalizeHash(emailHash)
    const minExpiresAt = new Date(Date.now() + 7 * DAY).toISOString()

    const invitation = await this.db.db
      .selectFrom('pending_invitations')
      .selectAll()
      .where('email_hash', '=', normalizedHash)
      .where('status', 'in', [
        'pending',
        'email_pending',
        'email_sent',
        'email_failed',
      ])
      .where('jid', 'is not', null)
      .where('expires_at', '>', minExpiresAt)
      .executeTakeFirst()

    return invitation || null
  }

  /**
   * Delete specific invitation by ID
   */
  async deleteInvitation(id: number): Promise<void> {
    await this.db.db
      .deleteFrom('pending_invitations')
      .where('id', '=', id)
      .execute()

    dbLogger.info({ invitationId: id }, 'Deleted invitation after use')
  }

  /**
   * Mark invitation as consumed (instead of deleting)
   */
  async consumeInvitation(
    email: string,
    did: string,
    handle: string,
  ): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email)
    const emailHash = this.hashEmail(normalizedEmail)
    const now = new Date().toISOString()

    await this.db.db
      .updateTable('pending_invitations')
      .set({
        status: 'consumed',
        consumed_at: now,
        consuming_did: did,
        consuming_handle: handle,
      })
      .where((qb) =>
        qb
          .where('email_hash', '=', emailHash)
          .orWhere('email', '=', normalizedEmail),
      )
      .where('status', '=', 'pending')
      .execute()

    dbLogger.info(
      {
        emailHash: this.hashEmail(normalizedEmail),
        did,
        handle,
      },
      'Invitation consumed',
    )
  }

  async consumeInvitationByHash(
    emailHash: string,
    did: string,
    handle: string,
  ): Promise<void> {
    const normalizedHash = this.normalizeHash(emailHash)
    const now = new Date().toISOString()

    await this.db.db
      .updateTable('pending_invitations')
      .set({
        status: 'consumed',
        consumed_at: now,
        consuming_did: did,
        consuming_handle: handle,
      })
      .where('email_hash', '=', normalizedHash)
      .where('status', '=', 'pending')
      .execute()

    dbLogger.info(
      {
        emailHash: normalizedHash,
        did,
        handle,
      },
      'Invitation consumed by hash',
    )
  }

  /**
   * Consume invitation by JID (for JID-based account creation)
   * Only consumes invitations matching the specific JID
   *
   * NOTE: Compares only the UUID portion (local part before @)
   * to handle cases where stored JID is just UUID but received JID includes domain
   */
  async consumeInvitationByJid(
    jid: string,
    did: string,
    handle: string,
  ): Promise<void> {
    const now = new Date().toISOString()

    // Extract just the UUID portion (local part before @)
    const jidLocalPart = jid.split('@')[0]

    // Fetch active invitations
    const invitations = await this.db.db
      .selectFrom('pending_invitations')
      .selectAll()
      .where('status', 'in', [
        'pending',
        'email_pending',
        'email_sent',
        'email_failed',
      ])
      .where('jid', 'is not', null)
      .execute()

    // Find matching invitation by UUID comparison
    const matchingInvitation = invitations.find((inv) => {
      if (!inv.jid) return false

      const storedLocalPart = inv.jid.split('@')[0]

      return storedLocalPart === jidLocalPart
    })

    if (!matchingInvitation) {
      return // No matching invitation to consume
    }

    // Update the matching invitation
    const result = await this.db.db
      .updateTable('pending_invitations')
      .set({
        status: 'consumed',
        consumed_at: now,
        consuming_did: did,
        consuming_handle: handle,
      })
      .where('id', '=', matchingInvitation.id)
      .executeTakeFirst()

    if (Number(result.numUpdatedRows || 0) > 0) {
      dbLogger.info(
        {
          jid: jid.substring(0, 8) + '...', // Log only prefix for privacy
          did,
          handle,
        },
        'Invitation consumed by JID',
      )
    }
  }

  /**
   * Create invitation with JID and onboarding URL
   * Used after successful Neuro account allocation
   */
  async createInvitationWithJid(
    email: string,
    jid: string,
    onboardingUrl: string,
    preferredHandle?: string | null,
    invitationTimestamp?: number,
  ): Promise<PendingInvitationEntry> {
    this.ensureInvitationHashSaltConfigured()

    const normalizedEmail = this.normalizeEmail(email)
    const emailHash = this.hashEmail(normalizedEmail)
    const now = new Date().toISOString()
    const timestamp = invitationTimestamp || Math.floor(Date.now() / 1000)
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS).toISOString()

    dbLogger.info(
      {
        emailHash,
        jid: jid.substring(0, 8) + '...', // Log only prefix
        hasPreferredHandle: !!preferredHandle,
      },
      'Creating invitation with JID',
    )

    // Upsert invitation with JID - handles re-inviting revoked/expired emails
    await this.db.db
      .insertInto('pending_invitations')
      .values({
        email: normalizedEmail,
        email_hash: emailHash,
        jid,
        onboarding_url: onboardingUrl,
        preferred_handle: preferredHandle || null,
        invitation_timestamp: timestamp,
        created_at: now,
        expires_at: expiresAt,
        status: 'pending', // Main invitation status
        email_attempt_count: 0,
      })
      .onConflict((oc) =>
        oc.column('email').doUpdateSet({
          email_hash: emailHash,
          jid,
          onboarding_url: onboardingUrl,
          preferred_handle: preferredHandle || null,
          invitation_timestamp: timestamp,
          created_at: now,
          expires_at: expiresAt,
          status: 'pending',
          email_attempt_count: 0,
        }),
      )
      .execute()

    // Fetch the created invitation
    const invitation = await this.db.db
      .selectFrom('pending_invitations')
      .selectAll()
      .where('jid', '=', jid)
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!invitation) {
      throw new Error('Failed to create invitation')
    }

    return invitation
  }

  /**
   * Update existing invitation for reminder send
   * Reuses same JID and onboarding URL
   */
  async updateInvitationForReminder(
    id: number,
    preferredHandle?: string | null,
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      // Status remains 'pending' - email tracking is separate
    }

    if (preferredHandle !== undefined) {
      updates.preferred_handle = preferredHandle
    }

    await this.db.db
      .updateTable('pending_invitations')
      .set(updates)
      .where('id', '=', id)
      .execute()

    dbLogger.info({ invitationId: id }, 'Updated invitation for reminder')
  }

  /**
   * Update email delivery status
   */
  async updateEmailDeliveryStatus(
    id: number,
    status: 'email_sent' | 'email_failed',
    error?: string,
    messageId?: string,
  ): Promise<void> {
    const now = new Date().toISOString()

    const invitation = await this.db.db
      .selectFrom('pending_invitations')
      .select('email_attempt_count')
      .where('id', '=', id)
      .executeTakeFirst()

    await this.db.db
      .updateTable('pending_invitations')
      .set({
        email_last_sent_at: now,
        email_attempt_count: (invitation?.email_attempt_count || 0) + 1,
        email_last_error: error || null,
        email_message_id: messageId || null,
      })
      .where('id', '=', id)
      .execute()

    dbLogger.info(
      { invitationId: id, emailStatus: status, error, messageId },
      'Updated email delivery status',
    )
  }

  /**
   * Revoke pending invitation
   * Returns error if invitation is not pending
   */
  async revokeInvitation(idOrEmail: number | string): Promise<void> {
    const isId = typeof idOrEmail === 'number'

    let query = this.db.db
      .updateTable('pending_invitations')
      .set({ status: 'revoked' })
      .where('status', '=', 'pending')

    if (isId) {
      query = query.where('id', '=', idOrEmail)
    } else {
      const normalizedInput = idOrEmail.trim().toLowerCase()
      if (normalizedInput.includes('@')) {
        const emailHash = this.hashEmail(normalizedInput)
        query = query.where((qb) =>
          qb
            .where('email_hash', '=', emailHash)
            .orWhere('email', '=', normalizedInput),
        )
      } else {
        query = query.where((qb) =>
          qb
            .where('email_hash', '=', normalizedInput)
            .orWhere('email', '=', normalizedInput),
        )
      }
    }

    const result = await query.executeTakeFirst()

    if (Number(result.numUpdatedRows || 0) === 0) {
      throw new Error('Invitation not found or not pending')
    }

    dbLogger.info(
      {
        [isId ? 'id' : 'emailHash']: isId
          ? idOrEmail
          : this.hashEmail(idOrEmail),
      },
      'Invitation revoked',
    )
  }

  /**
   * Delete all expired invitations
   * Returns count of deleted invitations
   */
  async deleteExpiredInvitations(): Promise<number> {
    const now = new Date().toISOString()

    // Mark expired invitations
    await this.db.db
      .updateTable('pending_invitations')
      .set({ status: 'expired' })
      .where('status', '=', 'pending')
      .where('expires_at', '<=', now)
      .execute()

    dbLogger.info('Marked expired invitations')

    return 0 // No longer deleting, just marking
  }

  /**
   * Purge invitations by status and optional timestamp
   * Applies 1-second safety buffer to prevent race conditions
   */
  async purgeInvitations(
    status: 'consumed' | 'expired' | 'revoked',
    beforeTimestamp?: string,
  ): Promise<number> {
    const oneSecondAgo = new Date(Date.now() - 1000).toISOString()

    let query = this.db.db
      .deleteFrom('pending_invitations')
      .where('status', '=', status)

    // Apply safety buffer based on status
    if (status === 'consumed') {
      // For consumed: check consumed_at
      query = query.where('consumed_at', '<', oneSecondAgo)
      if (beforeTimestamp) {
        query = query.where('consumed_at', '<', beforeTimestamp)
      }
    } else {
      // For expired/revoked: check created_at
      query = query.where('created_at', '<', oneSecondAgo)
      if (beforeTimestamp) {
        query = query.where('created_at', '<', beforeTimestamp)
      }
    }

    const result = await query.executeTakeFirst()
    const count = Number(result.numDeletedRows || 0)

    dbLogger.info(
      { status, count, before: beforeTimestamp },
      'Purged invitations',
    )

    return count
  }

  /**
   * Get invitations with optional filtering
   * Applies 1-second safety buffer for consumed_at/created_at
   */
  async getInvitations(filters?: {
    status?: 'pending' | 'consumed' | 'expired' | 'revoked' | 'all'
    beforeTimestamp?: string
    limit?: number
    offset?: number
  }): Promise<PendingInvitationEntry[]> {
    const oneSecondAgo = new Date(Date.now() - 1000).toISOString()
    const status = filters?.status || 'pending'
    const limit = filters?.limit || 50
    const offset = filters?.offset || 0

    let query = this.db.db.selectFrom('pending_invitations').selectAll()

    // Filter by status
    if (status !== 'all') {
      query = query.where('status', '=', status)
    }

    // Apply timestamp filter with safety buffer
    if (status === 'consumed') {
      query = query.where('consumed_at', '<', oneSecondAgo)
      if (filters?.beforeTimestamp) {
        query = query.where('consumed_at', '<', filters.beforeTimestamp)
      }
    } else if (status === 'pending') {
      query = query.where('created_at', '<', oneSecondAgo)
      if (filters?.beforeTimestamp) {
        query = query.where('created_at', '<', filters.beforeTimestamp)
      }
    }

    // Apply pagination
    query = query.limit(limit).offset(offset).orderBy('created_at', 'desc')

    return await query.execute()
  }

  /**
   * Get invitation statistics
   */
  async getStats(sinceTimestamp?: string): Promise<{
    pending: number
    consumed: number
    expired: number
    revoked: number
    consumedSince?: number
    conversionRate?: string
  }> {
    // Get counts by status
    const counts = await this.db.db
      .selectFrom('pending_invitations')
      .select('status')
      .select((eb) => eb.fn.count('id').as('count'))
      .groupBy('status')
      .execute()

    const stats = {
      pending: 0,
      consumed: 0,
      expired: 0,
      revoked: 0,
    }

    for (const row of counts) {
      const count = Number(row.count)
      if (row.status === 'pending') stats.pending = count
      else if (row.status === 'consumed') stats.consumed = count
      else if (row.status === 'expired') stats.expired = count
      else if (row.status === 'revoked') stats.revoked = count
    }

    // Get consumed since timestamp if provided
    let consumedSince: number | undefined
    if (sinceTimestamp) {
      const result = await this.db.db
        .selectFrom('pending_invitations')
        .select((eb) => eb.fn.count('id').as('count'))
        .where('status', '=', 'consumed')
        .where('consumed_at', '>=', sinceTimestamp)
        .executeTakeFirst()

      consumedSince = Number(result?.count || 0)
    }

    // Calculate conversion rate
    const total = stats.consumed + stats.expired
    const conversionRate =
      total > 0 ? (stats.consumed / total).toFixed(2) : undefined

    return {
      ...stats,
      consumedSince,
      conversionRate,
    }
  }

  /**
   * Hash email for logging (privacy)
   */
  hashEmail(email: string): string {
    const normalizedEmail = this.normalizeEmail(email)
    this.ensureInvitationHashSaltConfigured()
    return createHmac('sha256', this.emailHashSalt!)
      .update(normalizedEmail)
      .digest('hex')
  }

  /**
   * Get pending invitation count (for monitoring)
   */
  async getPendingCount(): Promise<number> {
    const result = await this.db.db
      .selectFrom('pending_invitations')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('status', '=', 'pending')
      .executeTakeFirst()

    return Number(result?.count || 0)
  }
}
