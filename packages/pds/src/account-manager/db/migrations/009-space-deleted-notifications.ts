import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('space_deleted_notification_retry')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('service', 'varchar', (col) => col.notNull())
    .addColumn('attempts', 'integer', (col) => col.notNull())
    .addColumn('retryAt', 'integer', (col) => col.notNull())
    .addColumn('expiresAt', 'integer', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_deleted_notification_retry_pkey', [
      'space',
      'service',
    ])
    .execute()
  await db.schema
    .createIndex('space_deleted_notification_retry_at_idx')
    .on('space_deleted_notification_retry')
    .column('retryAt')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('space_deleted_notification_retry').execute()
}
