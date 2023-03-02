import { Kysely } from 'kysely'
import { Dialect } from '..'

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
    .addPrimaryKeyConstraint('blob_creator_pkey', ['creator', 'cid'])
    .execute()

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
    .expression((exp) =>
      exp
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

  const res = await db.selectFrom('blob').selectAll().execute()
  const unique = res.reduce((acc, cur) => {
    const { creator, ...rest } = cur
    acc[cur.cid] ??= rest
    return acc
  }, {})

  if (res.length > 0) {
    await db.insertInto('blob_new').values(Object.values(unique)).execute()
  }

  await db.schema.dropTable('blob').execute()
  await db.schema.alterTable('blob_new').renameTo('blob').execute()
}
