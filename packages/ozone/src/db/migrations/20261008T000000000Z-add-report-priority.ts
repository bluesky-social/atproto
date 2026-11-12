import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report')
    .addColumn('priorityLevel', 'varchar')
    .addColumn('priorityScore', 'integer')
    .addColumn('priorityTargetMinutes', 'integer')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report')
    .dropColumn('priorityLevel')
    .dropColumn('priorityScore')
    .dropColumn('priorityTargetMinutes')
    .execute()
}
