import { Generated, Selectable } from 'kysely'

// NeuroIdentityLink: Privacy-separated pseudonymous identity keys.
// PDS stores ONLY pseudonymous JID keys; no validated identity attributes.
// WID (Neuro) owns all identity verification, eligibility, invitations.
export interface NeuroIdentityLink {
  userJid: string | null // XMPP JID for REAL users (isTestUser=0) — QuickLogin lookup key
  testUserJid: string | null // XMPP JID for TEST USERS (isTestUser=1) — never used for real-user auth
  did: string // Foreign key to actor.did
  isTestUser: number // 1 for test users, 0 for real users (SQLite stores boolean as INTEGER)
  linkedAt: Generated<string> // ISO timestamp of first link
  lastLoginAt: string | null // ISO timestamp of last successful login
}

export type NeuroIdentityLinkEntry = Selectable<NeuroIdentityLink>

export const tableName = 'neuro_identity_link'

export type PartialDB = { [tableName]: NeuroIdentityLink }
