import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Moderation event
  await db.schema
    .createTable('moderation_event')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('subjectType', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar')
    .addColumn('subjectCid', 'varchar')
    .addColumn('comment', 'text')
    .addColumn('meta', 'jsonb')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('reversedAt', 'varchar')
    .addColumn('reversedBy', 'varchar')
    .addColumn('durationInHours', 'integer')
    .addColumn('expiresAt', 'varchar')
    .addColumn('reversedReason', 'text')
    .addColumn('createLabelVals', 'varchar')
    .addColumn('negateLabelVals', 'varchar')
    .addColumn('legacyRefId', 'integer')
    .execute()

  // Moderation subject status
  await db.schema
    .createTable('moderation_subject_status')
    .addColumn('id', 'serial', (col) => col.primaryKey())

    // Identifiers
    .addColumn('did', 'varchar', (col) => col.notNull())
    // Default to '' so that we can apply unique constraints on did and recordPath columns
    .addColumn('recordPath', 'varchar', (col) => col.notNull().defaultTo(''))
    .addColumn('blobCids', 'jsonb')
    .addColumn('recordCid', 'varchar')

    // human review team state
    .addColumn('reviewState', 'varchar', (col) => col.notNull())
    .addColumn('comment', 'varchar')
    .addColumn('muteUntil', 'varchar')
    .addColumn('lastReviewedAt', 'varchar')
    .addColumn('lastReviewedBy', 'varchar')

    // report state
    .addColumn('lastReportedAt', 'varchar')

    // visibility/intervention state
    .addColumn('takendown', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('suspendUntil', 'varchar')

    // timestamps
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('moderation_status_unique_idx', ['did', 'recordPath'])
    .execute()

  await db.schema
    .createIndex('moderation_subject_status_blob_cids_idx')
    .on('moderation_subject_status')
    .using('gin')
    .column('blobCids')
    .execute()

  // Label
  await db.schema
    .createTable('label')
    .addColumn('src', 'varchar', (col) => col.notNull())
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('val', 'varchar', (col) => col.notNull())
    .addColumn('neg', 'boolean', (col) => col.notNull())
    .addColumn('cts', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('label_pkey', ['src', 'uri', 'cid', 'val'])
    .execute()
  await db.schema
    .createIndex('label_uri_index')
    .on('label')
    .column('uri')
    .execute()

  // PushEvent
  await db.schema
    .createTable('push_event')
    .addColumn('eventType', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar')
    .addColumn('subjectCid', 'varchar')
    .addColumn('subjectBlobCid', 'varchar')
    .addColumn('takedownId', 'integer')
    .addColumn('confirmedAt', 'varchar')
    .addPrimaryKeyConstraint('push_event_pkey', [
      'eventType',
      'subjectDid',
      'subjectUri',
      'subjectBlobCid',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('moderation_event').execute()
  await db.schema.dropTable('moderation_subject_status').execute()
  await db.schema.dropTable('label').execute()
  await db.schema.dropTable('push_event').execute()
}
