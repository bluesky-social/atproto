import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('notif_op')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('actorDid', 'varchar', (col) => col.notNull())
    .addColumn('priority', 'boolean')
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute()
  await db.schema
    .createTable('notif_item')
    .addColumn('actorDid', 'varchar', (col) => col.primaryKey())
    .addColumn('priority', 'boolean', (col) => col.notNull())
    .addColumn('fromId', 'bigint', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('notif_item').execute()
  await db.schema.dropTable('notif_op').execute()
}
