import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // moderation actions
  await db.schema
    .createTable('moderation_action')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('subjectType', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar')
    .addColumn('subjectCid', 'varchar')
    .addColumn('reason', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('reversedAt', 'varchar')
    .addColumn('reversedBy', 'varchar')
    .addColumn('reversedReason', 'text')
    .addColumn('createLabelVals', 'varchar')
    .addColumn('negateLabelVals', 'varchar')
    .execute()
  await db.schema
    .createTable('moderation_action_subject_blob')
    .addColumn('actionId', 'integer', (col) =>
      col.notNull().references('moderation_action.id'),
    )
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('moderation_action_subject_blob_pkey', [
      'actionId',
      'cid',
    ])
    .execute()
  await db.schema
    .createIndex('moderation_action_subject_blob_cid_idx')
    .on('moderation_action_subject_blob')
    .column('cid')
    .execute()

  // moderation reports
  await db.schema
    .createTable('moderation_report')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('subjectType', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar')
    .addColumn('subjectCid', 'varchar')
    .addColumn('reasonType', 'varchar', (col) => col.notNull())
    .addColumn('reason', 'text')
    .addColumn('reportedByDid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()

  // moderation report resolutions
  await db.schema
    .createTable('moderation_report_resolution')
    .addColumn('reportId', 'integer', (col) =>
      col.notNull().references('moderation_report.id'),
    )
    .addColumn('actionId', 'integer', (col) =>
      col.notNull().references('moderation_action.id'),
    )
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('moderation_report_resolution_pkey', [
      'reportId',
      'actionId',
    ])
    .execute()
  await db.schema
    .createIndex('moderation_report_resolution_action_id_idx')
    .on('moderation_report_resolution')
    .column('actionId')
    .execute()

  // labels
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

  // foreign keys
  await db.schema
    .alterTable('actor')
    .addForeignKeyConstraint(
      'actor_takedown_id_fkey',
      ['takedownId'],
      'moderation_action',
      ['id'],
    )
    .execute()
  await db.schema
    .alterTable('record')
    .addForeignKeyConstraint(
      'record_takedown_id_fkey',
      ['takedownId'],
      'moderation_action',
      ['id'],
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('record')
    .dropConstraint('record_takedown_id_fkey')
    .execute()
  await db.schema
    .alterTable('actor')
    .dropConstraint('actor_takedown_id_fkey')
    .execute()
  await db.schema.dropTable('label').execute()
  await db.schema.dropTable('moderation_report_resolution').execute()
  await db.schema.dropTable('moderation_report').execute()
  await db.schema.dropTable('moderation_action_subject_blob').execute()
  await db.schema.dropTable('moderation_action').execute()
}
