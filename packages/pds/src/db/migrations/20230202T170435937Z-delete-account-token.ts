import { Kysely } from 'kysely'

const deleteTokenTable = 'delete_account_token'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(deleteTokenTable)
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('token', 'varchar', (col) => col.notNull())
    .addColumn('requestedAt', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(deleteTokenTable).execute()
}
