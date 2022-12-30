import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('mute')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('mutedByDid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('mute_pkey', ['mutedByDid', 'did'])
    .execute()
  // Unrelated to muting: add notification indexing for per-user notifications
  await db.schema
    .createIndex('user_notification_did_indexed_at_idx')
    .on('user_notification')
    .columns(['userDid', 'indexedAt'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('mute').execute()
  await db.schema
    .dropIndex('user_notification_did_indexed_at_idx')
    .on('user_notification')
    .execute()
}
