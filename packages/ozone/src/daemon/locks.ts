// Stable seeds for pg advisory locks used to coordinate daemon work across
// instances. Each daemon hashes its seed with the database and schema.
export const STATS_COMPUTER_LOCK_ID = 7_239_401
