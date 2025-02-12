import { Kysely, sql } from 'kysely'

// support lookup for chat.bsky.moderation.getMessageContext

export async function up(db: Kysely<unknown>): Promise<void> {
  // @NOTE: These queries should be run with the "CONCURRENTLY" option in
  // production to avoid locking the table. This is not supported by Kysely.
  await db.schema.dropIndex('moderation_event_message_id_index').execute()
  await db.schema
    .createIndex('moderation_event_message_id_idx')
    .on('moderation_event')
    // https://github.com/kysely-org/kysely/issues/302
    .expression(
      sql`"subjectMessageId") WHERE ("subjectMessageId" IS NOT NULL AND "action" = 'tools.ozone.moderation.defs#modEventReport'`,
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('moderation_event_message_id_idx').execute()
  await db.schema
    .createIndex('moderation_event_message_id_index')
    .on('moderation_event')
    .column('subjectMessageId')
    .execute()
}
