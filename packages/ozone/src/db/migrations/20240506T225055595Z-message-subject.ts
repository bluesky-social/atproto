import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .addColumn('subjectMessageId', 'varchar')
    .execute()
  // support lookup for chat.bsky.moderation.getMessageContext
  await db.schema
    .createIndex('moderation_event_message_id_index')
    .on('moderation_event')
    .column('subjectMessageId')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .dropColumn('subjectMessageId')
    .execute()
}
