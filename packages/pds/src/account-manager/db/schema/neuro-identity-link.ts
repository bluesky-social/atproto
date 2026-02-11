import { Generated, Selectable } from 'kysely'

export interface NeuroIdentityLink {
  legalId: string | null // Neuro Legal ID (for real users, NULL for test users)
  jid: string | null // XMPP JID (for test users, NULL for real users)
  did: string // Foreign key to actor.did
  email: string | null // Cached from Neuro identity
  userName: string | null // Cached from Neuro identity
  isTestUser: number // 1 for test users, 0 for real users (SQLite stores boolean as INTEGER)
  linkedAt: Generated<string> // ISO timestamp
  lastLoginAt: string | null // ISO timestamp
}

export type NeuroIdentityLinkEntry = Selectable<NeuroIdentityLink>

export const tableName = 'neuro_identity_link'

export type PartialDB = { [tableName]: NeuroIdentityLink }
