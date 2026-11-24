import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('space')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('deletedAt', 'varchar')
    .execute()

  // Serves listSpaces filtered by type. Partial, matching listSpaces' deletedAt
  // filter. A filter by authority is a range of the uri primary key instead.
  await db.schema
    .createIndex('space_type_idx')
    .on('space')
    .columns(['type', 'uri'])
    .where(sql.ref('deletedAt'), 'is', null)
    .execute()

  await db.schema
    .createTable('simplespace_config')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('policy', 'varchar', (col) => col.notNull())
    .addColumn('managingApp', 'varchar')
    .addColumn('appAccessType', 'varchar', (col) => col.notNull())
    .addColumn('appAllowed', 'text', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('simplespace_member')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('simplespace_member_pkey', ['space', 'did'])
    .execute()

  await db.schema
    .createTable('space_record')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('value', 'blob', (col) => col.notNull())
    .addColumn('repoRev', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  // Serves listCollections, clearRecords, importRepo's scan of existing records,
  // deleteSpaceBlobs, and listRepoOps's join to the current record. Paging a
  // space's records goes through the uri primary key instead (see uri-range.ts).
  await db.schema
    .createIndex('space_record_path_idx')
    .on('space_record')
    .columns(['space', 'collection', 'rkey'])
    .unique()
    .execute()

  // Keyed by record uri as record_blob is. Metadata stays in `blob`.
  await db.schema
    .createTable('space_record_blob')
    .addColumn('blobCid', 'varchar', (col) => col.notNull())
    .addColumn('recordUri', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_record_blob_pkey', ['blobCid', 'recordUri'])
    .execute()

  // Serves the space_record join in listBlobs and the space-wide delete.
  await db.schema
    .createIndex('space_record_blob_record_idx')
    .on('space_record_blob')
    .column('recordUri')
    .execute()

  await db.schema
    .createTable('space_repo')
    .addColumn('space', 'varchar', (col) => col.primaryKey())
    .addColumn('setHash', 'blob')
    .addColumn('rev', 'varchar')
    .execute()

  await db.schema
    .createTable('space_record_oplog')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('rev', 'varchar', (col) => col.notNull())
    .addColumn('idx', 'integer', (col) => col.notNull())
    // No uri or action: an op joins to its record by (space, collection, rkey),
    // and its action follows from cid and prev.
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar')
    .addColumn('prev', 'varchar')
    .addPrimaryKeyConstraint('space_record_oplog_pkey', ['space', 'rev', 'idx'])
    .execute()

  await db.schema
    .createTable('space_writer')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('rev', 'varchar', (col) => col.notNull())
    .addColumn('hash', 'blob', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_writer_pkey', ['space', 'did'])
    .execute()

  // Services registered (via registerNotify) to receive write notifications.
  await db.schema
    .createTable('space_credential_recipient')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('serviceDid', 'varchar', (col) => col.notNull())
    .addColumn('serviceEndpoint', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_credential_recipient_pkey', [
      'space',
      'serviceDid',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('space_credential_recipient').execute()
  await db.schema.dropTable('space_writer').execute()
  await db.schema.dropTable('space_record_oplog').execute()
  await db.schema.dropTable('space_repo').execute()
  await db.schema.dropTable('space_record_blob').execute()
  await db.schema.dropTable('space_record').execute()
  await db.schema.dropTable('simplespace_member').execute()
  await db.schema.dropTable('simplespace_config').execute()
  await db.schema.dropTable('space').execute()
}
