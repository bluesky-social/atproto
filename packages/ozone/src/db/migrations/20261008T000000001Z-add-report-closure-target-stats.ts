import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_stat')
    .addColumn('closureTargetMetCount', 'integer')
    .addColumn('closureTargetMissedCount', 'integer')
    .addColumn('closureTargetOverdueCount', 'integer')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_stat')
    .dropColumn('closureTargetMetCount')
    .dropColumn('closureTargetMissedCount')
    .dropColumn('closureTargetOverdueCount')
    .execute()
}
