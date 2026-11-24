import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('record')
    .addColumn('editedAt', 'varchar')
    .execute()
  await db.schema
    .createTable('post_version')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('json', 'varchar', (col) => col.notNull())
    .addColumn('editedAt', 'varchar')
    .addPrimaryKeyConstraint('post_version_pkey', ['uri', 'cid'])
    .addForeignKeyConstraint(
      'post_version_uri_fkey',
      ['uri'],
      'record',
      ['uri'],
      (constraint) => constraint.onDelete('cascade'),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('post_version').execute()
  await db.schema.alterTable('record').dropColumn('editedAt').execute()
}
