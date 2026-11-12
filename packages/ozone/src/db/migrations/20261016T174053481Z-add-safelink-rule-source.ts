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

  await db.schema
    .createIndex('safelink_rule_source_idx')
    .on('safelink_rule')
    .column('source')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('safelink_rule_source_idx').execute()
  await db.schema.alterTable('safelink_event').dropColumn('source').execute()
  await db.schema.alterTable('safelink_rule').dropColumn('source').execute()
}
