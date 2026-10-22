export interface KemKeyBackfillLease {
  id: number
  owner: string
  expiresAt: number
  completedAt: string | null
}

export type PartialDB = {
  kem_key_backfill_lease: KemKeyBackfillLease
}
