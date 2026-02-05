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
      })
      .onConflict((oc) =>
        oc.column('email').doUpdateSet({
          preferred_handle: preferredHandle || null,
          invitation_timestamp: timestamp,
          created_at: now,
          expires_at: expiresAt,
        }),
      )
      .execute()
  }

  /**
   * Get invitation by email (case-insensitive)
   * Returns null if not found or expired
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
   * Delete all expired invitations
   * Returns count of deleted invitations
   */
  async deleteExpiredInvitations(): Promise<number> {
    const now = new Date().toISOString()

    const result = await this.db.db
      .deleteFrom('pending_invitations')
      .where('expires_at', '<=', now)
      .executeTakeFirst()

    const count = Number(result.numDeletedRows || 0)

    dbLogger.info({ count }, 'Cleaned up expired invitations')

    return count
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
    const now = new Date().toISOString()

    const result = await this.db.db
      .selectFrom('pending_invitations')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('expires_at', '>', now)
      .executeTakeFirst()

    return Number(result?.count || 0)
  }
}
