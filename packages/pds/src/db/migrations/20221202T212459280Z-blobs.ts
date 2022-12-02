import { Kysely } from 'kysely'

const tempRepoBlobsTable = 'temp_repo_blob'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(tempRepoBlobsTable)
    .addColumn('tempKey', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('mimeType', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(tempRepoBlobsTable).execute()
}
