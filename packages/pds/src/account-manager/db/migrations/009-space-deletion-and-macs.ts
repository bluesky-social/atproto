import { type Kysely, sql } from 'kysely'

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

  await db.schema
    .alterTable('space_notification_retry')
    .renameColumn('hash', 'data')
    .execute()

  // @TODO remove before beta, along with `kem-key-backfill.ts`
  await db.schema
    .createTable('kem_key_backfill_lease')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('owner', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'integer', (col) => col.notNull())
    .addColumn('completedAt', 'varchar')
    .execute()
  await sql`
    insert into kem_key_backfill_lease (id, owner, expiresAt) values (1, '', 0)
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('kem_key_backfill_lease').execute()
  await db.schema
    .alterTable('space_notification_retry')
    .renameColumn('data', 'hash')
    .execute()
  await db.schema.dropTable('space_deleted_notification_retry').execute()
}
