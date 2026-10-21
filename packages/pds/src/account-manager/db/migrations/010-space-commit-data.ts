import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_notification_retry')
    .renameColumn('hash', 'data')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_notification_retry')
    .renameColumn('data', 'hash')
    .execute()
}
