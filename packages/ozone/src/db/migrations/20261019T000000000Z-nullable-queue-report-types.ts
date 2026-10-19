import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_queue')
    .alterColumn('reportTypes', (col) => col.dropNotNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE report_queue SET "reportTypes" = '[]'::jsonb WHERE "reportTypes" IS NULL`.execute(
    db,
  )
  await db.schema
    .alterTable('report_queue')
    .alterColumn('reportTypes', (col) => col.setNotNull())
    .execute()
}
