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
    .createTable('moderation_subject_status')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('subjectType', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar')
    .addColumn('subjectCid', 'varchar')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('updatedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('moderation_subject_status_unique_key', [
      'subjectDid',
      'subjectUri',
      'subjectCid',
    ])
    .execute()
  await db.schema
    .createIndex('moderation_subject_status')
    .on('moderation_subject_status')
    .columns(['subjectType', 'subjectDid', 'subjectUri'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
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
  await db.schema.dropTable('moderation_subject_status').execute()
}
