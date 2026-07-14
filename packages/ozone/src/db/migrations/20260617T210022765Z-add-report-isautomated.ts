import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('report')
    .addColumn('isAutomated', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('report').dropColumn('isAutomated').execute()
}
