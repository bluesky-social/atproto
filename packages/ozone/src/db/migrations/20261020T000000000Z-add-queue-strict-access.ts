import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_queue')
    .addColumn('strictAccess', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report_queue')
    .dropColumn('strictAccess')
    .execute()
}
