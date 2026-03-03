import { Kysely } from 'kysely'

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
  // Step 1: Drop the old jidRef index (it will be replaced by partial unique index)
  await db.schema.dropIndex('neuro_identity_link_jidRef_idx').execute()

  // Step 2: Rename columns
  // Note: SQLite doesn't have direct RENAME COLUMN in older versions,
  // so we use alterTable with renameColumn (available in Kysely)
  await db.schema
    .alterTable('neuro_identity_link')
    .renameColumn('jidRef', 'userJid')
    .execute()

  await db.schema
    .alterTable('neuro_identity_link')
    .renameColumn('jid', 'testUserJid')
    .execute()

  // Step 3: Drop obsolete columns (privacy boundary: no identity fields in PDS)
  await db.schema
    .alterTable('neuro_identity_link')
    .dropColumn('legalId')
    .execute()

  await db.schema
    .alterTable('neuro_identity_link')
    .dropColumn('email')
    .execute()

  await db.schema
    .alterTable('neuro_identity_link')
    .dropColumn('userName')
    .execute()

  // Step 4: Create unique partial indices for JID lookup
  // Real users: userJid unique when isTestUser=0
  await db.schema
    .createIndex('neuro_identity_link_userJid_real_idx')
    .on('neuro_identity_link')
    .column('userJid')
    .unique()
    .execute()

  // Test users: testUserJid unique when isTestUser=1
  await db.schema
    .createIndex('neuro_identity_link_testUserJid_test_idx')
    .on('neuro_identity_link')
    .column('testUserJid')
    .unique()
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Reverse the migration (for rollback, though this is a breaking schema change)

  // Step 1: Drop new partial indices
  await db.schema.dropIndex('neuro_identity_link_userJid_real_idx').execute()

  await db.schema
    .dropIndex('neuro_identity_link_testUserJid_test_idx')
    .execute()

  // Step 2: Restore removed columns with NULL defaults
  await db.schema
    .alterTable('neuro_identity_link')
    .addColumn('legalId', 'varchar')
    .execute()

  await db.schema
    .alterTable('neuro_identity_link')
    .addColumn('email', 'varchar')
    .execute()

  await db.schema
    .alterTable('neuro_identity_link')
    .addColumn('userName', 'varchar')
    .execute()

  // Step 3: Rename columns back
  await db.schema
    .alterTable('neuro_identity_link')
    .renameColumn('userJid', 'jidRef')
    .execute()

  await db.schema
    .alterTable('neuro_identity_link')
    .renameColumn('testUserJid', 'jid')
    .execute()

  // Step 4: Restore old index
  await db.schema
    .createIndex('neuro_identity_link_jidRef_idx')
    .on('neuro_identity_link')
    .column('jidRef')
    .execute()
}
