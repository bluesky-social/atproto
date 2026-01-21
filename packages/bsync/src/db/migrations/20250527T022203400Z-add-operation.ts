import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('operation')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('actorDid', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('method', 'int2', (col) => col.notNull())
    .addColumn('payload', sql`bytea`)
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('operation').execute()
}
