import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .addColumn('modTool', 'jsonb')
    .execute()

  await db.schema
    .createIndex('moderation_event_mod_tool_name_idx')
    .on('moderation_event')
    .expression(sql`("modTool" ->> 'name')`)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('moderation_event').dropColumn('modTool').execute()
}
