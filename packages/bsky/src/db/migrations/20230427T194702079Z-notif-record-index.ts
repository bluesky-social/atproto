import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Supports record deletion
  await db.schema
    .createIndex('notification_record_idx')
    .on('notification')
    .column('recordUri')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('notification_record_idx').execute()
}
