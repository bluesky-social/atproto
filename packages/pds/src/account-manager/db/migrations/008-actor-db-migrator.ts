import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor')
    .addColumn(
      'storeSchemaVersion',
      'varchar',
      (col) => col.notNull().defaultTo('001'), // current latest schema version for actor store
    )
    .execute()
  await db.schema
    .alterTable('actor')
    .addColumn('storeIsMigrating', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .execute()
  await db.schema
    .alterTable('actor')
    .addColumn('storeMigratedAt', 'varchar')
    .execute()
  await db.schema
    .createIndex('actor_store_schema_version_idx')
    .on('actor')
    .column('storeSchemaVersion')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('actor_store_schema_version_idx').execute()
  await db.schema.alterTable('actor').dropColumn('storeSchemaVersion').execute()
  await db.schema.alterTable('actor').dropColumn('storeIsMigrating').execute()
  await db.schema.alterTable('actor').dropColumn('storeMigratedAt').execute()
}
