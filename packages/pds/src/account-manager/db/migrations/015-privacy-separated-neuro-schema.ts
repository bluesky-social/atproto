import { Kysely, sql } from 'kysely'

// Migration 015: Restructure neuro_identity_link for privacy separation.
//
// Background:
//   The unified QuickLogin protocol enforces strict privacy boundaries:
//   - WID (Neuro) owns validated identity, eligibility, invitations
//   - PDS owns pseudonymous account keys only
//   This migration removes all identity fields from PDS and renames JID fields
//   for semantic clarity:
//   - jidRef → userJid (real users, linked via isTestUser=0)
//   - jid → testUserJid (test users, linked via isTestUser=1)
//   - DROP: legalId, email, userName (no longer sent by WID, privacy boundary)
//
// Changes:
//   1. Rename jidRef → userJid
//   2. Rename jid → testUserJid
//   3. Drop legalId, email, userName
//   4. Add unique partial index on userJid where isTestUser=0
//   5. Add unique partial index on testUserJid where isTestUser=1
//   6. Drop old jidRef index (replaced by new partial index)

export async function up(db: Kysely<unknown>): Promise<void> {
  // SQLite-safe migration path:
  // - legalId was historically PRIMARY KEY and cannot be dropped in place.
  // - Some DBs may be pre-014 (no jidRef), post-014 (has jidRef), or partially migrated.
  // Rebuild table and map columns dynamically.

  const tableRows = (
    await sql<{ name: string }>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('neuro_identity_link', 'neuro_identity_link_old')
    `.execute(db)
  ).rows

  const hasCurrent = tableRows.some((row) => row.name === 'neuro_identity_link')
  const hasOld = tableRows.some((row) => row.name === 'neuro_identity_link_old')

  // If this is first run of migration, move current table aside.
  if (hasCurrent && !hasOld) {
    await db.schema
      .alterTable('neuro_identity_link')
      .renameTo('neuro_identity_link_old')
      .execute()
  }

  // Create target table if missing (works for fresh and re-run cases).
  await sql`
    CREATE TABLE IF NOT EXISTS neuro_identity_link (
      did VARCHAR PRIMARY KEY,
      userJid VARCHAR,
      testUserJid VARCHAR,
      isTestUser INTEGER NOT NULL DEFAULT 0,
      linkedAt VARCHAR NOT NULL,
      lastLoginAt VARCHAR
    )
  `.execute(db)

  const tableRowsAfter = (
    await sql<{ name: string }>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = 'neuro_identity_link_old'
    `.execute(db)
  ).rows

  const hasOldAfter = tableRowsAfter.some(
    (row) => row.name === 'neuro_identity_link_old',
  )

  if (hasOldAfter) {
    const oldRows = (
      await sql<any>`SELECT * FROM neuro_identity_link_old`.execute(db)
    ).rows as Array<Record<string, any>>

    // Ensure re-runs don't duplicate.
    await sql`DELETE FROM neuro_identity_link`.execute(db)

    for (const row of oldRows) {
      const did = row.did as string | undefined
      if (!did) continue

      // Source compatibility:
      // - post-014: jidRef exists
      // - pre-014: only legalId exists
      // - in-progress/newer: userJid/testUserJid may already exist
      const userJid = row.userJid ?? row.jidRef ?? row.legalId ?? null
      const testUserJid = row.testUserJid ?? row.jid ?? null
      const isTestUser = row.isTestUser ?? (testUserJid ? 1 : 0)
      const linkedAt = row.linkedAt ?? new Date().toISOString()
      const lastLoginAt = row.lastLoginAt ?? null

      await sql`
        INSERT INTO neuro_identity_link (
          did,
          userJid,
          testUserJid,
          isTestUser,
          linkedAt,
          lastLoginAt
        ) VALUES (
          ${did},
          ${userJid},
          ${testUserJid},
          ${isTestUser},
          ${linkedAt},
          ${lastLoginAt}
        )
        ON CONFLICT(did) DO UPDATE SET
          userJid = excluded.userJid,
          testUserJid = excluded.testUserJid,
          isTestUser = excluded.isTestUser,
          linkedAt = excluded.linkedAt,
          lastLoginAt = excluded.lastLoginAt
      `.execute(db)
    }
  }

  // Indices (idempotent).
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS neuro_identity_link_userJid_real_idx
    ON neuro_identity_link(userJid)
  `.execute(db)

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS neuro_identity_link_testUserJid_test_idx
    ON neuro_identity_link(testUserJid)
  `.execute(db)

  await sql`
    CREATE INDEX IF NOT EXISTS neuro_identity_link_test_user_idx
    ON neuro_identity_link(isTestUser)
  `.execute(db)

  // Remove old table if present.
  await sql`DROP TABLE IF EXISTS neuro_identity_link_old`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Reverse with the same SQLite-safe table rebuild strategy.

  // 1) Rename current table
  await db.schema
    .alterTable('neuro_identity_link')
    .renameTo('neuro_identity_link_new')
    .execute()

  // 2) Recreate old schema (legalId was the original PRIMARY KEY)
  await db.schema
    .createTable('neuro_identity_link')
    .addColumn('legalId', 'varchar', (col) => col.primaryKey())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('email', 'varchar')
    .addColumn('userName', 'varchar')
    .addColumn('linkedAt', 'varchar', (col) => col.notNull())
    .addColumn('lastLoginAt', 'varchar')
    .addColumn('jid', 'varchar')
    .addColumn('isTestUser', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('jidRef', 'varchar')
    .execute()

  // 3) Move data back
  await sql`
    INSERT INTO neuro_identity_link (legalId, did, email, userName, linkedAt, lastLoginAt, jid, isTestUser, jidRef)
    SELECT userJid, did, NULL, NULL, linkedAt, lastLoginAt, testUserJid, isTestUser, userJid
    FROM neuro_identity_link_new
  `.execute(db)

  // 4) Recreate old indices
  await db.schema
    .createIndex('neuro_identity_link_did_idx')
    .on('neuro_identity_link')
    .column('did')
    .execute()

  await db.schema
    .createIndex('neuro_identity_link_jid_idx')
    .on('neuro_identity_link')
    .column('jid')
    .execute()

  await db.schema
    .createIndex('neuro_identity_link_test_user_idx')
    .on('neuro_identity_link')
    .column('isTestUser')
    .execute()

  await db.schema
    .createIndex('neuro_identity_link_jidRef_idx')
    .on('neuro_identity_link')
    .column('jidRef')
    .execute()

  // 5) Drop rebuilt table
  await db.schema.dropTable('neuro_identity_link_new').execute()
}
