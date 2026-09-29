import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // @NOTE Daily closure statistics filter by closedAt rather than createdAt.
  // Index only closed reports so date-range queries can avoid scanning report history.
  await db.schema
    .createIndex('idx_report_closed_at')
    .on('report')
    .column('closedAt')
    .where('closedAt', 'is not', null)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('idx_report_closed_at').execute()
}
