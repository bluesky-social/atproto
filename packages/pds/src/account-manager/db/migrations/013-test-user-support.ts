import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Rename neuroJid to legalId (preserves all existing data)
  await db.schema
    .alterTable('neuro_identity_link')
    .renameColumn('neuroJid', 'legalId')
    .execute()

  // 2a. Add jid column
  await db.schema
    .alterTable('neuro_identity_link')
    .addColumn('jid', 'varchar')
    .execute()

  // 2b. Add isTestUser column (stored as INTEGER 0/1 in SQLite)
  await db.schema
    .alterTable('neuro_identity_link')
    .addColumn('isTestUser', 'integer', (col) => col.notNull().defaultTo(0))
    .execute()

  // 2c. Rename neuroJid to jid in neuro_pending_session table for consistency
  await db.schema
    .alterTable('neuro_pending_session')
    .renameColumn('neuroJid', 'jid')
    .execute()

  // 3. Create indexes for new columns
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop indexes
  await db.schema.dropIndex('neuro_identity_link_jid_idx').execute()
  await db.schema.dropIndex('neuro_identity_link_test_user_idx').execute()

  // Remove jid column
  await db.schema.alterTable('neuro_identity_link').dropColumn('jid').execute()

  // Remove isTestUser column
  await db.schema
    .alterTable('neuro_identity_link')
    .dropColumn('isTestUser')
    .execute()

  // Rename jid back to neuroJid in neuro_pending_session table
  await db.schema
    .alterTable('neuro_pending_session')
    .renameColumn('jid', 'neuroJid')
    .execute()

  // Rename back to neuroJid
  await db.schema
    .alterTable('neuro_identity_link')
    .renameColumn('legalId', 'neuroJid')
    .execute()
}
