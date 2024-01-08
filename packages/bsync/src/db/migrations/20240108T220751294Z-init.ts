import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('mute_op')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('op', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute()
  await db.schema
    .createTable('mute_item')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('fromId', 'bigint', (col) => col.notNull())
    .addPrimaryKeyConstraint('mute_op_pkey', ['did', 'subject'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('mute_item').execute()
  await db.schema.dropTable('mute_op').execute()
}
