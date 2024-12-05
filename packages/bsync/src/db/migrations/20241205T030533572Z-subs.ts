import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('subs_op')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('actorDid', 'varchar', (col) => col.notNull())
    .addColumn('entitlements', 'jsonb', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute()
  await db.schema
    .createTable('subs_item')
    .addColumn('actorDid', 'varchar', (col) => col.primaryKey())
    .addColumn('entitlements', 'jsonb', (col) => col.notNull())
    .addColumn('fromId', 'bigint', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('subs_item').execute()
  await db.schema.dropTable('subs_op').execute()
}
