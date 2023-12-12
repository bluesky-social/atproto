import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('moderation_record_snapshot')
    .addColumn('id', 'serial', (col) => col.primaryKey())

    // Identifiers, maintaining similarity with moderation_subject_status table
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('recordPath', 'varchar', (col) => col.notNull())
    // set to empty string in order to be able to create unique index
    .addColumn('blobCid', 'varchar', (col) => col.notNull().defaultTo(''))
    .addColumn('recordCid', 'varchar')
    // TODO: Intended to store raw CBOR/json in here
    .addColumn('recordContent', 'text', (col) => col.notNull())

    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('moderation_record_snapshot_unique_idx', [
      'did',
      'recordPath',
      'blobCid',
      'recordCid',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('moderation_record_snapshot').execute()
}
