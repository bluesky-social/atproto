import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // moderation_event
  await db.schema
    .alterTable('moderation_event')
    .addColumn('subjectConvoId', 'varchar')
    .execute()
  /// broad index to support conversation-based queries
  /// Users is a convo is capped at 50 so volume of matching events should be low
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
  /// Create new unique index, drop old constraint, rename new index
  /// Avoids gap without any constraints
  await sql`
    CREATE UNIQUE INDEX "moderation_status_unique_idx_new"
    ON moderation_subject_status(did, "recordPath", "convoId")
  `.execute(db)
  await db.schema
    .alterTable('moderation_subject_status')
    .dropConstraint('moderation_status_unique_idx')
    .execute()
  await db.schema.dropIndex('moderation_status_unique_idx').ifExists().execute()
  await sql`
    ALTER INDEX "moderation_status_unique_idx_new"
    RENAME TO "moderation_status_unique_idx"
  `.execute(db)
  await sql`
    ALTER TABLE moderation_subject_status
    ADD CONSTRAINT "moderation_status_unique_idx"
    UNIQUE USING INDEX "moderation_status_unique_idx"
  `.execute(db)

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

  // report table
  await db.schema
    .alterTable('report')
    .addColumn('subjectConvoId', 'varchar')
    .execute()
  await db.schema.dropIndex('idx_report_unassigned_id').execute()
  await sql`CREATE INDEX idx_report_unassigned_id ON report
    (id)
    INCLUDE (status, "reportType", "recordPath", "subjectMessageId", "subjectConvoId")
    WHERE ("queueId" IS NULL AND status != 'closed')`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // report
  await db.schema.dropIndex('idx_report_unassigned_id').execute()
  await sql`CREATE INDEX idx_report_unassigned_id ON report
    (id)
    INCLUDE (status, "reportType", "recordPath", "subjectMessageId")
    WHERE ("queueId" IS NULL AND status != 'closed')`.execute(db)
  await db.schema.alterTable('report').dropColumn('subjectConvoId').execute()

  // expiring_tag
  await db.schema
    .dropIndex('idx_expiring_tag_did_record_path_convo_id')
    .execute()
  await db.schema.alterTable('expiring_tag').dropColumn('convoId').execute()

  // moderation_subject_status
  /// Reverse the unique constraint change: [did, recordPath, convoId] -> [did, recordPath]
  await sql`
    CREATE UNIQUE INDEX "moderation_status_unique_idx_old"
    ON moderation_subject_status(did, "recordPath")
  `.execute(db)
  await db.schema
    .alterTable('moderation_subject_status')
    .dropConstraint('moderation_status_unique_idx')
    .execute()
  await db.schema.dropIndex('moderation_status_unique_idx').ifExists().execute()
  await sql`
    ALTER INDEX "moderation_status_unique_idx_old"
    RENAME TO "moderation_status_unique_idx"
  `.execute(db)
  await sql`
    ALTER TABLE moderation_subject_status
    ADD CONSTRAINT "moderation_status_unique_idx"
    UNIQUE USING INDEX "moderation_status_unique_idx"
  `.execute(db)
  await db.schema
    .alterTable('moderation_subject_status')
    .dropColumn('convoId')
    .execute()

  // moderation_event
  await db.schema.dropIndex('moderation_event_convo_idx').execute()
  await db.schema
    .alterTable('moderation_event')
    .dropColumn('subjectConvoId')
    .execute()
}
