import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Supports record deletion
  await db.schema
    .createIndex('user_notification_record_idx')
    .on('user_notification')
    .column('recordUri')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('user_notification_record_idx').execute()
}
