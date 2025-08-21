import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Only small percentage of moderation events have a batchId in modTool meta property so we're creating a partial index
  await sql`
    CREATE INDEX moderation_event_mod_tool_batch_id_idx
    ON moderation_event (("modTool" -> 'meta' ->> 'batchId'))
    WHERE "modTool" #> '{meta,batchId}' IS NOT NULL
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('moderation_event_mod_tool_batch_id_idx').execute()
}
