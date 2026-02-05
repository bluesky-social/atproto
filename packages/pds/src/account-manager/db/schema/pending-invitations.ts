import { Generated, Selectable } from 'kysely'

export interface PendingInvitation {
  id: Generated<number>
  email: string
  preferred_handle: string | null
  invitation_timestamp: number
  created_at: string
  expires_at: string
  status: string
  consumed_at: string | null
  consuming_did: string | null
  consuming_handle: string | null
}

export type PendingInvitationEntry = Selectable<PendingInvitation>

export const tableName = 'pending_invitations'

export type PartialDB = { [tableName]: PendingInvitation }
