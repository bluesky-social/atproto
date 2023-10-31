import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('repo_root')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('rev', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('repo_block')
    .addColumn('cid', 'varchar', (col) => col.primaryKey())
    .addColumn('repoRev', 'varchar', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('content', 'blob', (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex('repo_block_repo_rev_idx')
    .on('repo_block')
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
    .addColumn('takedownRef', 'varchar')
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
    .addColumn('takedownRef', 'varchar')
    .execute()
  await db.schema
    .createIndex('blob_tempkey_idx')
    .on('blob')
    .column('tempKey')
    .execute()

  await db.schema
    .createTable('record_blob')
    .addColumn('blobCid', 'varchar', (col) => col.notNull())
    .addColumn('recordUri', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`record_blob_pkey`, ['blobCid', 'recordUri'])
    .execute()

  await db.schema
    .createTable('backlink')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('path', 'varchar', (col) => col.notNull())
    .addColumn('linkTo', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('backlinks_pkey', ['uri', 'path'])
    .execute()
  await db.schema
    .createIndex('backlink_link_to_idx')
    .on('backlink')
    .columns(['path', 'linkTo'])
    .execute()

  await db.schema
    .createTable('account_pref')
    .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('valueJson', 'text', (col) => col.notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('account_pref').execute()
  await db.schema.dropTable('backlink').execute()
  await db.schema.dropTable('record_blob').execute()
  await db.schema.dropTable('blob').execute()
  await db.schema.dropTable('record').execute()
  await db.schema.dropTable('repo_block').execute()
  await db.schema.dropTable('repo_root').execute()
}
