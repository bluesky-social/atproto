import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('repo_op')
    .addColumn('did', 'text', (col) => col.notNull())
    .addColumn('commit', 'text', (col) => col.notNull())
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('cid', 'text')
    .addPrimaryKeyConstraint('repo_op_pkey', ['did', 'commit', 'path'])
    .execute()

  await db.deleteFrom('repo_seq').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('repo_op').execute()
}
