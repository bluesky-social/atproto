import { Generated, Selectable } from 'kysely'

export interface NeuroPendingSession {
  sessionId: string // Primary key
  serviceId: string // Neuro service ID
  requestUri: string | null // OAuth request URI for correlation
  deviceId: string | null // OAuth device ID
  createdAt: Generated<string> // ISO timestamp
  expiresAt: string // ISO timestamp (5 minutes from creation)
  completedAt: string | null // ISO timestamp when identity received
  jid: string | null // Neuro JID - set when callback received
}

export type NeuroPendingSessionEntry = Selectable<NeuroPendingSession>

export const tableName = 'neuro_pending_session'

export type PartialDB = { [tableName]: NeuroPendingSession }
