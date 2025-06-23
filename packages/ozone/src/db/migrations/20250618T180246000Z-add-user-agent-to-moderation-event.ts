import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .addColumn('userAgent', 'jsonb')
    .execute()

  // Add index on userAgent->>'name' for efficient querying by userAgent name
  await db.schema
    .createIndex('moderation_event_user_agent_name_idx')
    .on('moderation_event')
    .expression(sql`("userAgent" ->> 'name')`)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .dropColumn('userAgent')
    .execute()
}
