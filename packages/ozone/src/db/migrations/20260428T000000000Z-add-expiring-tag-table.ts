import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('expiring_tag')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('eventId', 'integer', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('recordPath', 'varchar', (col) => col.notNull())
    .addColumn('tag', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .execute()

  // Daemon polls for expired tags
  await db.schema
    .createIndex('idx_expiring_tag_expires_at')
    .on('expiring_tag')
    .column('expiresAt')
    .execute()

  // Cleanup queries when tags are manually removed
  await db.schema
    .createIndex('idx_expiring_tag_did_record_path')
    .on('expiring_tag')
    .columns(['did', 'recordPath'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('expiring_tag').execute()
}
