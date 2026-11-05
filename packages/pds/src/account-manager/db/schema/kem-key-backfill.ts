import type { DateISO } from '../../../db/index.js'

export interface KemKeyBackfillLease {
  id: number
  owner: string
  expiresAt: number
  completedAt: DateISO | null
}

export type PartialDB = {
  kem_key_backfill_lease: KemKeyBackfillLease
}
