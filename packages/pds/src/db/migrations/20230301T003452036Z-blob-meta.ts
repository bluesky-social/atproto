import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('blob_new')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('mimeType', 'varchar', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('tempKey', 'varchar')
    .addColumn('width', 'integer')
    .addColumn('height', 'integer')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('blob_pkey', ['creator', 'cid'])
    .execute()

  const res = await db.selectFrom('blob').limit(1).selectAll().execute()
  if (res.length > 0) {
    await db
      .insertInto('blob_new')
      .columns([
        'creator',
        'cid',
        'mimeType',
        'size',
        'tempKey',
        'width',
        'height',
        'createdAt',
      ])
      .values(
        db
          .selectFrom('blob')
          .innerJoin('repo_blob', 'repo_blob.cid', 'blob.cid')
          .select([
            'repo_blob.did',
            'blob.cid',
            'blob.mimeType',
            'blob.size',
            'blob.tempKey',
            'blob.width',
            'blob.height',
            'blob.createdAt',
          ]),
      )
      .execute()
  }

  await db.schema.dropTable('blob').execute()
  await db.schema.alterTable('blob_new').renameTo('blob').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('blob_new')
    .addColumn('cid', 'varchar', (col) => col.primaryKey())
    .addColumn('mimeType', 'varchar', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('tempKey', 'varchar')
    .addColumn('width', 'integer')
    .addColumn('height', 'integer')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()

  const res = await db.selectFrom('blob').limit(1).selectAll().execute()
  if (res.length > 0) {
    await db
      .insertInto('blob_new')
      .columns([
        'cid',
        'mimeType',
        'size',
        'tempKey',
        'width',
        'height',
        'createdAt',
      ])
      .values(
        db
          .selectFrom('blob')
          .select([
            'blob.cid',
            'blob.mimeType',
            'blob.size',
            'blob.tempKey',
            'blob.width',
            'blob.height',
            'blob.createdAt',
          ]),
      )
      .execute()
  }

  await db.schema.dropTable('blob').execute()
  await db.schema.alterTable('blob_new').renameTo('blob').execute()
}
