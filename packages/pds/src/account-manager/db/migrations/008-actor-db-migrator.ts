import { Kysely, sql } from 'kysely'

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

  // efficiently get unmigrated actors, oldest-first
  await db.schema
    .createIndex('actor_store_schema_version_idx')
    .on('actor')
    .columns(['storeSchemaVersion', 'storeMigratedAt'])
    .execute()

  // make it cheap to COUNT number of in-progress migrations
  await db.schema
    .createIndex('actor_store_is_migrating_idx')
    .on('actor')
    // https://github.com/kysely-org/kysely/issues/302
    .expression(sql`"storeIsMigrating") WHERE ("storeIsMigrating" = 1`)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('actor_store_is_migrating_idx').execute()
  await db.schema.dropIndex('actor_store_schema_version_idx').execute()
  await db.schema.alterTable('actor').dropColumn('storeSchemaVersion').execute()
  await db.schema.alterTable('actor').dropColumn('storeIsMigrating').execute()
  await db.schema.alterTable('actor').dropColumn('storeMigratedAt').execute()
}
