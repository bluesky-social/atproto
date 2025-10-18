import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Optimized index that takes pagination into account
  await sql`
    CREATE INDEX IF NOT EXISTS moderation_event_subject_did_created_at_idx
    ON moderation_event ("subjectDid", "createdAt" DESC, id DESC)
  `.execute(db)

  // Drop the old index for subject did that's not very optimized
  await db.schema.dropIndex('moderation_event_subject_did_idx').execute()

  // create the new optimized index for batch id
  await sql`
    CREATE INDEX "moderation_event_batch_created_id_desc_idx"
    ON "moderation_event" ( ("modTool"->'meta'->>'batchId'), "createdAt" DESC, "id" DESC )
    WHERE ("modTool"->'meta'->>'batchId') IS NOT NULL
  `.execute(db)
  // Remove the old index for batch id that's not very optimized
  await sql`DROP INDEX IF EXISTS "moderation_event_mod_tool_batch_id_idx"`.execute(
    db,
  )

  // Add the trgm extension first
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db)

  // then add the trigram index for faster comment keyword search
  await sql`
      CREATE INDEX moderation_event_comment_trigram
      ON moderation_event USING gin(comment gin_trgm_ops)
      WHERE comment IS NOT NULL;
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('moderation_event_subject_did_idx')
    .on('moderation_event')
    .column('subjectDid')
    .execute()
  await db.schema
    .dropIndex('moderation_event_subject_did_created_at_idx')
    .execute()

  await sql`
    CREATE INDEX "moderation_event_mod_tool_batch_id_idx"
    ON "moderation_event" ( ("modTool" -> 'meta' ->> 'batchId') )
    WHERE "modTool" #> '{meta,batchId}' IS NOT NULL
  `.execute(db)
  await sql`DROP INDEX IF EXISTS "moderation_event_batch_created_id_desc_idx"`.execute(
    db,
  )

  await sql`DROP INDEX IF EXISTS "moderation_event_comment_trigram"`.execute(db)
  await sql`DROP EXTENSION IF EXISTS pg_trgm CASCADE`.execute(db)
}
