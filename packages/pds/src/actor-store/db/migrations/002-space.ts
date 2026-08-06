import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // A space this account holds a repo in, whoever governs it.
  await db.schema
    .createTable('space')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    // Denormalized out of the uri (`at://<authority>/space/<type>/<skey>`) so that
    // listSpaces can filter on columns rather than pattern-matching the uri.
    .addColumn('authority', 'varchar', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('deletedAt', 'varchar')
    .execute()

  // Governance for the spaces this account is the authority for. Separate from `space`
  // because a member holds a repo in spaces it has no say over, and is never told their
  // policy — so a row here exists only for a space this account created.
  await db.schema
    .createTable('simplespace_config')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('policy', 'varchar', (col) =>
      col.notNull().defaultTo('member-list'),
    )
    .addColumn('managingApp', 'varchar')
    .addColumn('appAccessType', 'varchar', (col) =>
      col.notNull().defaultTo('open'),
    )
    .addColumn('appAllowed', 'text', (col) => col.notNull().defaultTo('[]'))
    .execute()

  // Plain host-internal member list (no rev / commit state).
  await db.schema
    .createTable('simplespace_member')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('simplespace_member_pkey', ['space', 'did'])
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

  // Keyed as space_record is, rather than by uri as record_blob is, so listing
  // blobs since a revision is a plain join. Metadata stays in `blob`.
  await db.schema
    .createTable('space_record_blob')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('blobCid', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_record_blob_pkey', [
      'space',
      'collection',
      'rkey',
      'blobCid',
    ])
    .execute()

  // By cid alone for reachability checks across the whole store; by (space, blobCid)
  // for listBlobs, which the pkey can't serve with blobCid as its 4th column.
  await db.schema
    .createIndex('space_record_blob_cid_idx')
    .on('space_record_blob')
    .column('blobCid')
    .execute()

  await db.schema
    .createIndex('space_record_blob_space_cid_idx')
    .on('space_record_blob')
    .columns(['space', 'blobCid'])
    .execute()

  // Per-repo commit state (LtHash set hash + rev).
  await db.schema
    .createTable('space_repo')
    .addColumn('space', 'varchar', (col) => col.primaryKey())
    .addColumn('setHash', 'blob')
    .addColumn('rev', 'varchar')
    .execute()

  // Append-only record write log for incremental sync.
  await db.schema
    .createTable('space_record_oplog')
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('rev', 'varchar', (col) => col.notNull())
    .addColumn('idx', 'integer', (col) => col.notNull())
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar')
    .addColumn('prev', 'varchar')
    .addPrimaryKeyConstraint('space_record_oplog_pkey', ['space', 'rev', 'idx'])
    .execute()

  // Writer set: accounts that have written to a space, maintained by the
  // authority from incoming notifyWrite calls. Returned by listRepos.
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
