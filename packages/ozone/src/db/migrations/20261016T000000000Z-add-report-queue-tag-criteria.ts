import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_queue')
    .addColumn('reporterTags', 'jsonb')
    .addColumn('accountTags', 'jsonb')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_queue')
    .dropColumn('reporterTags')
    .dropColumn('accountTags')
    .execute()
}
