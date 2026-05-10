import { Kysely, sql } from 'kysely'

// Migration 021: Add 'unverified' accountType for lightweight-onboarded accounts.
//
// Changes:
//   1. Add accountTypeNew column (TEXT NOT NULL DEFAULT 'unverified').
//   2. Backfill accountTypeNew from existing accountType values (preserve all
//      existing 'personal', 'bot', 'test', 'organization' rows unchanged).
//   3. Drop the old accountType column.
//   4. Rename accountTypeNew -> accountType.
//
// Note: SQLite 3.45.3 supports DROP COLUMN natively (no table rebuild needed).
// down() restores the old column (new 'unverified' rows fall back to 'organization').

export async function up(db: Kysely<unknown>): Promise<void> {
  // Step 1: Add new column with 'unverified' as default
  await sql`ALTER TABLE actor ADD COLUMN accountTypeNew TEXT NOT NULL DEFAULT 'unverified'`.execute(
    db,
  )

  // Step 2: Backfill — copy existing values
  await sql`UPDATE actor SET accountTypeNew = accountType`.execute(db)

  // Step 3: Drop old column
  await sql`ALTER TABLE actor DROP COLUMN accountType`.execute(db)

  // Step 4: Rename new column to accountType
  await sql`ALTER TABLE actor RENAME COLUMN accountTypeNew TO accountType`.execute(
    db,
  )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Reverse: add old column back with 'organization' as default
  await sql`ALTER TABLE actor ADD COLUMN accountTypeOld TEXT NOT NULL DEFAULT 'organization'`.execute(
    db,
  )

  // Copy back, mapping 'unverified' -> 'organization'
  await sql`
    UPDATE actor
    SET accountTypeOld = CASE
      WHEN accountType = 'unverified' THEN 'organization'
      ELSE accountType
    END
  `.execute(db)

  await sql`ALTER TABLE actor DROP COLUMN accountType`.execute(db)
  await sql`ALTER TABLE actor RENAME COLUMN accountTypeOld TO accountType`.execute(
    db,
  )
}
