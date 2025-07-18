import { Generated } from 'kysely'

export interface Actor {
  did: string
  handle: string | null
  indexedAt: string
  takedownRef: string | null
  upstreamStatus: string | null
  trustedVerifier: Generated<boolean>
  ageAssuranceStatus: string | null
  ageAssuranceLastInitiatedAt: string | null
}

export const tableName = 'actor'

export type PartialDB = { [tableName]: Actor }
