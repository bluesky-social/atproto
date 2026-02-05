import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add status tracking columns to pending_invitations
  await db.schema
    .alterTable('pending_invitations')
    .addColumn('status', 'varchar', (col) => col.notNull().defaultTo('pending'))
    .execute()

  await db.schema
    .alterTable('pending_invitations')
    .addColumn('consumed_at', 'varchar')
    .execute()

  await db.schema
    .alterTable('pending_invitations')
    .addColumn('consuming_did', 'varchar')
    .execute()

  await db.schema
    .alterTable('pending_invitations')
    .addColumn('consuming_handle', 'varchar')
    .execute()

  // Create indexes for filtering
  await db.schema
    .createIndex('idx_pending_invitations_status')
    .on('pending_invitations')
    .column('status')
    .execute()

  await db.schema
    .createIndex('idx_pending_invitations_consumed_at')
    .on('pending_invitations')
    .column('consumed_at')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop indexes
  await db.schema.dropIndex('idx_pending_invitations_status').execute()

  await db.schema.dropIndex('idx_pending_invitations_consumed_at').execute()

  // SQLite doesn't support DROP COLUMN, so we'd need to recreate table
  // For now, leave columns in place (safe for down migration)
}
