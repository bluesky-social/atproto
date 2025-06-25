import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX "moderation_event_account_reports_idx"
    ON moderation_event("createdBy","subjectDid", "createdAt")
    WHERE "subjectUri" IS NULL
    AND "action" = 'tools.ozone.moderation.defs#modEventReport'
  `.execute(db)

  await sql`
    CREATE INDEX "moderation_event_record_reports_idx"
    ON moderation_event("createdBy","subjectDid","subjectUri", "createdAt")
    WHERE "subjectUri" IS NOT NULL
    AND "action" = 'tools.ozone.moderation.defs#modEventReport'
  `.execute(db)

  await sql`
    CREATE INDEX "moderation_event_account_actions_ids"
    ON moderation_event("subjectDid","action", "createdAt")
    WHERE "subjectUri" IS NULL
    AND "action" IN ( 'tools.ozone.moderation.defs#modEventTakedown', 'tools.ozone.moderation.defs#modEventLabel')
  `.execute(db)

  await sql`
    CREATE INDEX "moderation_event_record_actions_ids"
    ON moderation_event("subjectDid","subjectUri", "action", "createdAt")
    WHERE "subjectUri" IS NOT NULL
    AND "action" IN ( 'tools.ozone.moderation.defs#modEventTakedown', 'tools.ozone.moderation.defs#modEventLabel')
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('moderation_event_account_reports_idx').execute()
  await db.schema.dropIndex('moderation_event_record_reports_idx').execute()
  await db.schema.dropIndex('moderation_event_account_actions_ids').execute()
  await db.schema.dropIndex('moderation_event_record_actions_ids').execute()
}
