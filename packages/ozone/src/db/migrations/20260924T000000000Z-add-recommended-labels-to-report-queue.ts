import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_queue')
    .addColumn('recommendedLabels', 'jsonb', (col) =>
      col.notNull().defaultTo(sql`'[]'::jsonb`),
    )
    .execute()
  await sql`
    CREATE INDEX idx_report_queue_recommended_labels
    ON report_queue USING gin ("recommendedLabels" jsonb_path_ops)
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('idx_report_queue_recommended_labels')
    .ifExists()
    .execute()
  await db.schema
    .alterTable('report_queue')
    .dropColumn('recommendedLabels')
    .execute()
}
