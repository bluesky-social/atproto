import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_action')
    .renameColumn('reason', 'comment')
    .execute()
  await db.schema
    .alterTable('moderation_action')
    .alterColumn('comment')
    .dropNotNull()
    .execute()
  await db.schema
    .alterTable('moderation_action')
    .addColumn('refEventId', 'integer')
    .execute()
  await db.schema
    .alterTable('moderation_action')
    .addColumn('meta', 'jsonb')
    .execute()
  await db.schema
    .alterTable('moderation_action')
    .renameTo('moderation_event')
    .execute()
  await db.schema
    .createTable('moderation_subject_status')
    .addColumn('id', 'serial', (col) => col.primaryKey())

    // Identifiers
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('recordPath', 'varchar')
    .addColumn('recordCid', 'varchar')

    // human review team state
    .addColumn('reviewState', 'varchar', (col) => col.notNull())
    .addColumn('note', 'varchar')
    .addColumn('muteUntil', 'varchar')
    .addColumn('lastReviewedAt', 'varchar')

    // report state
    .addColumn('lastReportedAt', 'varchar')

    // visibility/intervention state
    .addColumn('takendown', 'boolean', (col) => col.defaultTo(false).notNull())
    .addColumn('suspendUntil', 'varchar')

    // timestamps
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())

    // indices
    .addUniqueConstraint('moderation_subject_status_unique_key', [
      'did',
      'recordPath',
      'recordCid',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('moderation_event').renameTo('moderation_action')
  await db.schema
    .alterTable('moderation_action')
    .renameColumn('comment', 'reason')
    .execute()
  await db.schema
    .alterTable('moderation_action')
    .alterColumn('reason')
    .setNotNull()
    .execute()
  await db.schema.alterTable('moderation_action').dropColumn('meta').execute()
  await db.schema
    .alterTable('moderation_action')
    .dropColumn('refEventId')
    .execute()
  await db.schema.dropTable('moderation_subject_status').execute()
}
