import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .addColumn('externalId', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .dropColumn('externalId')
    .execute()
}
