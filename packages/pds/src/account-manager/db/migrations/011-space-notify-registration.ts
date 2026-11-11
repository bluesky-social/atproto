import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Syncers now register an endpoint and token in place of a service. A pending
  // retry names a service and has no token, so it can't be carried over.
  await db.schema.dropTable('space_status_notification_retry').execute()
  await db.schema
    .createTable('space_status_notification_retry')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('endpoint', 'varchar', (col) => col.notNull())
    .addColumn('token', 'varchar', (col) => col.notNull())
    .addColumn('attempts', 'integer', (col) => col.notNull())
    .addColumn('retryAt', 'integer', (col) => col.notNull())
    .addColumn('expiresAt', 'integer', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_status_notification_retry_pkey', [
      'space',
      'endpoint',
      'token',
    ])
    .execute()
  await db.schema
    .createIndex('space_status_notification_retry_at_idx')
    .on('space_status_notification_retry')
    .column('retryAt')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('space_status_notification_retry').execute()
  // As left by 010, which renamed the table but not its key or index.
  await db.schema
    .createTable('space_status_notification_retry')
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
    .on('space_status_notification_retry')
    .column('retryAt')
    .execute()
}
