import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_deleted_notification_retry')
    .renameTo('space_status_notification_retry')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_status_notification_retry')
    .renameTo('space_deleted_notification_retry')
    .execute()
}
