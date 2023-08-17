import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('repo_root').addColumn('rev', 'varchar').execute()
  await db.schema
    .alterTable('ipld_block')
    .addColumn('repoRev', 'varchar')
    .execute()
  await db.schema
    .alterTable('repo_blob')
    .addColumn('repoRev', 'varchar')
    .execute()
  await db.schema.alterTable('repo_blob').dropColumn('commit').execute()

  await db.schema
    .createIndex('ipld_block_repo_rev_idx')
    .on('ipld_block')
    .columns(['creator', 'repoRev', 'cid'])
    .execute()

  await db.schema
    .createIndex('repo_blob_repo_rev_idx')
    .on('repo_blob')
    .columns(['did', 'repoRev'])
    .execute()

  await db.schema.dropTable('repo_commit_history').execute()
  await db.schema.dropTable('repo_commit_block').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('repo_commit_block')
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('block', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('repo_commit_block_pkey', [
      'creator',
      'commit',
      'block',
    ])
    .execute()
  await db.schema
    .createTable('repo_commit_history')
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('prev', 'varchar')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('repo_commit_history_pkey', ['creator', 'commit'])
    .execute()

  await db.schema.dropIndex('ipld_block_repo_rev_idx').execute()

  await db.schema.dropIndex('repo_blob_repo_rev_idx').execute()

  await db.schema.alterTable('repo_root').dropColumn('rev').execute()
  await db.schema.alterTable('ipld_block').dropColumn('repoRev').execute()
  await db.schema.alterTable('repo_blob').dropColumn('repoRev').execute()
  await db.schema
    .alterTable('repo_blob')
    .addColumn('commit', 'varchar')
    .execute()
}
