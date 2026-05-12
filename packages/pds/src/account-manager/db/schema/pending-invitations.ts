import { Generated, Selectable } from 'kysely'

export interface PendingInvitation {
  id: Generated<number>
  email: string
  email_hash: string | null
  preferred_handle: string | null
  invitation_timestamp: number
  created_at: string
  expires_at: string
  status: string
  consumed_at: string | null
  consuming_did: string | null
  consuming_handle: string | null
  jid: string | null
  onboarding_url: string | null
  invite_code: string | null
  email_last_sent_at: string | null
  email_attempt_count: number
  email_last_error: string | null
  email_message_id: string | null
}

export type PendingInvitationEntry = Selectable<PendingInvitation>

export const tableName = 'pending_invitations'

export type PartialDB = { [tableName]: PendingInvitation }
