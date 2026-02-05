import { DAY } from '@atproto/common'
import { dbLogger } from '../logger'
import { AccountDb } from './db'
import { PendingInvitationEntry } from './db/schema'

const INVITATION_EXPIRY_MS = 30 * DAY // 30 days

export class InvitationManager {
  constructor(public db: AccountDb) {}

  /**
   * Create a new invitation or update existing one
   * Email is normalized to lowercase for consistency
   */
  async createInvitation(
    email: string,
    preferredHandle?: string | null,
    invitationTimestamp?: number,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase()
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
        preferred_handle: preferredHandle || null,
        invitation_timestamp: timestamp,
        created_at: now,
        expires_at: expiresAt,
        status: 'pending',
      })
      .onConflict((oc) =>
        oc.column('email').doUpdateSet({
          preferred_handle: preferredHandle || null,
          invitation_timestamp: timestamp,
          created_at: now,
          expires_at: expiresAt,
          status: 'pending',
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
    const normalizedEmail = email.toLowerCase()
    const now = new Date().toISOString()

    const invitation = await this.db.db
      .selectFrom('pending_invitations')
      .selectAll()
      .where('email', '=', normalizedEmail)
      .where('status', '=', 'pending')
      .where('expires_at', '>', now)
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
    const normalizedEmail = email.toLowerCase()
    const now = new Date().toISOString()

    await this.db.db
      .updateTable('pending_invitations')
      .set({
        status: 'consumed',
        consumed_at: now,
        consuming_did: did,
        consuming_handle: handle,
      })
      .where('email', '=', normalizedEmail)
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
      query = query.where('email', '=', idOrEmail.toLowerCase())
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
    // Simple hash for logging - not cryptographic
    let hash = 0
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return hash.toString(16)
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
