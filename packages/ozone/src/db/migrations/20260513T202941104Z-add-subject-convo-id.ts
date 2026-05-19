import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // moderation_event
  await db.schema
    .alterTable('moderation_event')
    .addColumn('subjectConvoId', 'varchar')
    .execute()
  /// broad index to support conversation-based queries
  /// volume of matching events should be low
  /// subsequent ordering and filtering will be efficient
  await sql`
    CREATE INDEX "moderation_event_convo_idx"
    ON moderation_event("subjectConvoId")
    WHERE "subjectConvoId" IS NOT NULL
  `.execute(db)
  
  // moderation_subject_status
  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('convoId', 'varchar', (col) => col.notNull().defaultTo(''))
    .execute()
  /// Update unique constraint: [did, recordPath] -> [did, recordPath, convoId]
  await db.schema
    .alterTable('moderation_subject_status')
    .dropConstraint('moderation_status_unique_idx')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addUniqueConstraint('moderation_status_unique_idx', [
      'did',
      'recordPath',
      'convoId',
    ])
    .execute()

  // expiring_tag
  await db.schema
    .alterTable('expiring_tag')
    .addColumn('convoId', 'varchar', (col) => col.notNull().defaultTo(''))
    .execute()
  await db.schema
    .createIndex('idx_expiring_tag_did_record_path_convo_id')
    .on('expiring_tag')
    .columns(['did', 'recordPath', 'convoId'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // expiring_tag
  await db.schema.dropIndex('idx_expiring_tag_did_record_path_convo_id').execute()
  await db.schema.alterTable('expiring_tag').dropColumn('convoId').execute()

  // moderation_subject_status
  await db.schema
    .alterTable('moderation_subject_status')
    .dropConstraint('moderation_status_unique_idx')
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .addUniqueConstraint('moderation_status_unique_idx', ['did', 'recordPath'])
    .execute()
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('convoId')
    .execute()

  // moderation_event
  await db.schema.dropIndex('moderation_event_convo_idx').execute()
  await db.schema.alterTable('moderation_event').dropColumn('subjectConvoId').execute()
}
