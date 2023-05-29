import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('suggested_follow')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('suggested_follow').execute()
}
