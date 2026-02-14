import { Generated, Selectable } from 'kysely'

export interface NeuroIdentityLink {
  neuroJid: string // Primary key: Neuro Jabber ID
  did: string // Foreign key to actor.did
  email: string | null // Cached from Neuro identity
  userName: string | null // Cached from Neuro identity
  linkedAt: Generated<string> // ISO timestamp
  lastLoginAt: string | null // ISO timestamp
}

export type NeuroIdentityLinkEntry = Selectable<NeuroIdentityLink>

export const tableName = 'neuro_identity_link'

export type PartialDB = { [tableName]: NeuroIdentityLink }
