import { Selectable } from 'kysely'
import { DidString, HandleString } from '@atproto/syntax'

export interface Actor {
  did: DidString
  handle: HandleString | null
  createdAt: string
  takedownRef: string | null
  deactivatedAt: string | null
  deleteAfter: string | null
}

export type ActorEntry = Selectable<Actor>

export const tableName = 'actor'

export type PartialDB = { [tableName]: Actor }
