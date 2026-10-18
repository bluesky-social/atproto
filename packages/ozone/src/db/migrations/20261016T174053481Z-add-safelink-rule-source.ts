import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('safelink_rule')
    .addColumn('source', 'varchar', (col) =>
      col.notNull().defaultTo('ozone/default'),
    )
    .execute()

  await db.schema
    .alterTable('safelink_event')
    .addColumn('source', 'varchar', (col) =>
      col.notNull().defaultTo('ozone/default'),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('safelink_event').dropColumn('source').execute()
  await db.schema.alterTable('safelink_rule').dropColumn('source').execute()
}
