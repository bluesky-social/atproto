import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('repo_root')
    .addColumn('rev', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('ipld_block')
    .addColumn('cid', 'varchar', (col) => col.primaryKey())
    .addColumn('repoRev', 'varchar', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('content', 'blob', (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex('ipld_block_repo_rev_idx')
    .on('ipld_block')
    .columns(['repoRev', 'cid'])
    .execute()

  await db.schema
    .createTable('record')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('repoRev', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('takedownId', 'varchar')
    .execute()
  await db.schema
    .createIndex('record_cid_idx')
    .on('record')
    .column('cid')
    .execute()
  await db.schema
    .createIndex('record_collection_idx')
    .on('record')
    .column('collection')
    .execute()
  await db.schema
    .createIndex('record_repo_rev_idx')
    .on('record')
    .column('repoRev')
    .execute()

  await db.schema
    .createTable('blob')
    .addColumn('cid', 'varchar', (col) => col.primaryKey())
    .addColumn('mimeType', 'varchar', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('tempKey', 'varchar')
    .addColumn('width', 'integer')
    .addColumn('height', 'integer')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('takedownId', 'varchar')
    .execute()
  await db.schema
    .createIndex('blob_tempkey_idx')
    .on('blob')
    .column('tempKey')
    .execute()

  await db.schema
    .createTable('repo_blob')
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('recordUri', 'varchar', (col) => col.notNull())
    .addColumn('repoRev', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`repo_blob_pkey`, ['cid', 'recordUri'])
    .execute()

  await db.schema
    .createIndex('repo_blob_repo_rev_idx')
    .on('repo_blob')
    .column('repoRev')
    .execute()

  await db.schema
    .createTable('backlink')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('path', 'varchar', (col) => col.notNull())
    .addColumn('linkToUri', 'varchar')
    .addColumn('linkToDid', 'varchar')
    .addPrimaryKeyConstraint('backlinks_pkey', ['uri', 'path'])
    .addCheckConstraint(
      'backlink_link_to_chk',
      // Exactly one of linkToUri or linkToDid should be set
      sql`("linkToUri" is null and "linkToDid" is not null) or ("linkToUri" is not null and "linkToDid" is null)`,
    )
    .execute()
  await db.schema
    .createIndex('backlink_path_to_uri_idx')
    .on('backlink')
    .columns(['path', 'linkToUri'])
    .execute()
  await db.schema
    .createIndex('backlink_path_to_did_idx')
    .on('backlink')
    .columns(['path', 'linkToDid'])
    .execute()

  await db.schema
    .createTable('user_pref')
    .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('valueJson', 'text', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('user_pref').execute()
  await db.schema.dropTable('backlink').execute()
  await db.schema.dropTable('repo_blob').execute()
  await db.schema.dropTable('blob').execute()
  await db.schema.dropTable('record').execute()
  await db.schema.dropTable('ipld_block').execute()
  await db.schema.dropTable('repo_root').execute()
}
