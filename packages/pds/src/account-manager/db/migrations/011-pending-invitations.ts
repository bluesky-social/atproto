import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Create pending_invitations table
  await db.schema
    .createTable('pending_invitations')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('email', 'varchar', (col) => col.notNull().unique())
    .addColumn('preferred_handle', 'varchar')
    .addColumn('invitation_timestamp', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'varchar', (col) => col.notNull())
    .addColumn('expires_at', 'varchar', (col) => col.notNull())
    .execute()

  // Index for email lookups (already unique, but explicit for documentation)
  await db.schema
    .createIndex('pending_invitations_email_idx')
    .on('pending_invitations')
    .column('email')
    .execute()

  // Index for cleanup queries
  await db.schema
    .createIndex('pending_invitations_expires_at_idx')
    .on('pending_invitations')
    .column('expires_at')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('pending_invitations').execute()
}
