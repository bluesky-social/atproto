import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('label').addColumn('exp', 'varchar').execute()
  await db.schema
    .alterTable('label')
    .addColumn('sig', sql`bytea`)
    .execute()
  await db.schema
    .alterTable('label')
    .addColumn('signingKeyId', 'integer')
    .execute()
  await db.schema
    .createTable('signing_key')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('key', 'varchar', (col) => col.notNull().unique())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('signing_key')
  await db.schema.alterTable('label').dropColumn('exp').execute()
  await db.schema.alterTable('label').dropColumn('sig').execute()
  await db.schema.alterTable('label').dropColumn('signingKey').execute()
}
