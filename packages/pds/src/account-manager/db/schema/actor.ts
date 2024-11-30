import { Selectable } from 'kysely'

export interface Actor {
  did: string
  handle: string | null
  createdAt: string
  takedownRef: string | null
  deactivatedAt: string | null
  deleteAfter: string | null
}

export type ActorEntry = Selectable<Actor>

export const tableName = 'actor'

export type PartialDB = { [tableName]: Actor }
