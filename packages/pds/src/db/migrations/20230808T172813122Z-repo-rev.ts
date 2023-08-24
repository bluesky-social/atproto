import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('record').addColumn('repoRev', 'varchar').execute()
  await db.schema
    .createIndex('record_repo_rev_idx')
    .on('record')
    .columns(['did', 'repoRev'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('record_repo_rev_idx').execute()
  await db.schema.alterTable('record').dropColumn('repoRev').execute()
}
