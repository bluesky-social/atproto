import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('space')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('isOwner', 'integer', (col) => col.notNull())
    .addColumn('setHash', 'blob')
    .addColumn('rev', 'varchar')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('space_member')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('addedAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_member_pkey', ['space', 'did'])
    .execute()

  await db.schema
    .createTable('space_record')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('value', 'blob', (col) => col.notNull())
    .addColumn('repoRev', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_record_pkey', [
      'space',
      'collection',
      'rkey',
    ])
    .execute()

  await db.schema
    .createIndex('space_record_rev_idx')
    .on('space_record')
    .columns(['space', 'repoRev'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('space_record').execute()
  await db.schema.dropTable('space_member').execute()
  await db.schema.dropTable('space').execute()
}
