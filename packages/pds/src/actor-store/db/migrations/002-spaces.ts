import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('space')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('authority', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('deletedAt', 'varchar')
    .execute()

  await db.schema
    .createTable('space_policy')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('policyJson', 'text', (col) => col.notNull())
    .execute()

  // The member list of a space governed by the memberspace policy.
  await db.schema
    .createTable('memberspace_member')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('read', 'integer', (col) => col.notNull())
    .addColumn('write', 'integer', (col) => col.notNull())
    .addPrimaryKeyConstraint('memberspace_member_pkey', ['space', 'did'])
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
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('uri', 'varchar', (col) => col.notNull()) // used for joins
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
    .addColumn('spaceRev', 'varchar', (col) => col.notNull())
    .addColumn('repoRev', 'varchar', (col) => col.notNull())
    .addColumn('data', 'blob', (col) => col.notNull())
    .addColumn('removedAt', 'varchar')
    .addPrimaryKeyConstraint('space_writer_pkey', ['space', 'did'])
    .execute()
  await db.schema
    .createIndex('space_writer_space_rev_idx')
    .on('space_writer')
    .columns(['space', 'spaceRev'])
    .execute()

  // Endpoints registered (via authorizeSpaceSync) to receive notifications. A
  // registration is identified by its endpoint and token together.
  await db.schema
    .createTable('space_notify_registration')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('endpoint', 'varchar', (col) => col.notNull())
    .addColumn('token', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addColumn('expiryNotified', 'integer', (col) => col.notNull().defaultTo(0))
    .addPrimaryKeyConstraint('space_notify_registration_pkey', [
      'space',
      'endpoint',
      'token',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('space_notify_registration').execute()
  await db.schema.dropTable('space_writer').execute()
  await db.schema.dropTable('space_record_oplog').execute()
  await db.schema.dropTable('space_repo').execute()
  await db.schema.dropTable('space_record_blob').execute()
  await db.schema.dropTable('space_record').execute()
  await db.schema.dropTable('memberspace_member').execute()
  await db.schema.dropTable('space_policy').execute()
  await db.schema.dropTable('space').execute()
}
