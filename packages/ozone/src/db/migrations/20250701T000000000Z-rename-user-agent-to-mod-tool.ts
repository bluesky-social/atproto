import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Rename the column from userAgent to modTool
  await db.schema
    .alterTable('moderation_event')
    .renameColumn('userAgent', 'modTool')
    .execute()

  // Drop the old index
  await db.schema
    .dropIndex('moderation_event_user_agent_name_idx')
    .execute()

  // Create the new index with the new column name
  await db.schema
    .createIndex('moderation_event_mod_tool_name_idx')
    .on('moderation_event')
    .expression(sql`("modTool" ->> 'name')`)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Rename the column back from modTool to userAgent
  await db.schema
    .alterTable('moderation_event')
    .renameColumn('modTool', 'userAgent')
    .execute()

  // Drop the new index
  await db.schema
    .dropIndex('moderation_event_mod_tool_name_idx')
    .execute()

  // Recreate the old index
  await db.schema
    .createIndex('moderation_event_user_agent_name_idx')
    .on('moderation_event')
    .expression(sql`("userAgent" ->> 'name')`)
    .execute()
}