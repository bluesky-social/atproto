import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_action')
    .addColumn('durationInHours', 'integer')
    .execute()
  await db.schema
    .alterTable('moderation_action')
    .addColumn('expiresAt', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_action')
    .dropColumn('durationInHours')
    .execute()
  await db.schema
    .alterTable('moderation_action')
    .dropColumn('expiresAt')
    .execute()
}
