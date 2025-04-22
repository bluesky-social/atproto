import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('firehose_cursor')
    .addColumn('service', 'text', (col) => col.primaryKey())
    .addColumn('cursor', 'bigint')
    .addColumn('updatedAt', 'text', (col) =>
      col.defaultTo(sql`now()`).notNull(),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('firehose_cursor').execute()
}
