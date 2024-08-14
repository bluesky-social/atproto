import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Create the sets table
  await db.schema
    .createTable('ozone_set')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar', (col) => col.notNull().unique())
    .addColumn('description', 'varchar')
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute()

  // Create the set values table
  await db.schema
    .createTable('ozone_set_value')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('setId', 'integer', (col) =>
      col.notNull().references('ozone_set.id'),
    )
    .addColumn('value', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute()

  // Add indexes for better performance
  await db.schema
    .createIndex('ozone_set_name_idx')
    .on('ozone_set')
    .column('name')
    .execute()

  // Create a unique constraint on setId and value
  await db.schema
    .alterTable('ozone_set_value')
    .addUniqueConstraint('ozone_set_value_setid_value_unique', [
      'setId',
      'value',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('ozone_set_value').execute()
  await db.schema.dropTable('ozone_set').execute()
}
