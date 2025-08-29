import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('token')
    .addColumn('permissionsScope', 'varchar')
    .execute()

  await db.schema
    .createTable('lexicon')
    .addColumn('nsid', 'varchar', (col) => col.primaryKey())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addColumn('lastSucceededAt', 'varchar')
    .addColumn('uri', 'varchar')
    .addColumn('lexicon', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('lexicon').execute()
  await db.schema.alterTable('token').dropColumn('permissionsScope').execute()
}
