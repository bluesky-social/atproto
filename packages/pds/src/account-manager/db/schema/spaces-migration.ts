import type { Generated } from 'kysely'
import type { DatetimeString, DidString } from '@atproto/syntax'

// One row per account, recording facts about its migration into spaces
export interface SpacesMigration {
  did: DidString
  storeMigratedAt: DatetimeString | null
  kemPublishedAt: DatetimeString | null
  unpublishableReason: string | null
  attempts: Generated<number>
  lastError: string | null
  nextAttemptAt: Generated<DatetimeString | null>
  priority: Generated<number>
  leaseOwner: string | null
  leaseExpiresAt: DatetimeString | null
  sweepLeaseOwner: string | null
  sweepLeaseExpiresAt: DatetimeString | null
  sweepAttempts: Generated<number>
  sweepLastError: string | null
  sweepNextAttemptAt: Generated<DatetimeString>
}

// A single row, id = 1
export interface SpacesMigrationState {
  id: number
  publishStartAt: DatetimeString
}

// A single row, id = 1: counts over spaces_migration
export interface SpacesMigrationStats {
  id: number
  total: number
  storesMigrated: number
  keysPublished: number
  unpublishable: number
  deactivated: number
  failing: number
  sweepFailing: number
}

export const tableName = 'spaces_migration'
export const stateTableName = 'spaces_migration_state'
export const statsTableName = 'spaces_migration_stats'

export type PartialDB = {
  [tableName]: SpacesMigration
  [stateTableName]: SpacesMigrationState
  [statsTableName]: SpacesMigrationStats
}
