import { Selectable } from 'kysely'

export type AccountType = 'bot' | 'personal' | 'test' | 'organization' | 'unverified'

export interface Actor {
  did: string
  handle: string | null
  createdAt: string
  takedownRef: string | null
  deactivatedAt: string | null
  deleteAfter: string | null
  accountType: AccountType
}

export type ActorEntry = Selectable<Actor>

export const tableName = 'actor'

export type PartialDB = { [tableName]: Actor }

