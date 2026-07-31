import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('op_thread_reply')
    .addColumn('rootUri', 'varchar', (col) => col.notNull())
    .addColumn('parentUri', 'varchar', (col) => col.notNull())
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('deletedAt', 'varchar')
    .addPrimaryKeyConstraint('op_thread_reply_pkey', ['rootUri', 'uri'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('op_thread_reply').execute()
}
