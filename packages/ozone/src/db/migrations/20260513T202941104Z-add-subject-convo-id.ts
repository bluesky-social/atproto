import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('moderation_event')
    .addColumn('subjectConvoId', 'varchar')
    .execute()

  await db.schema
    .alterTable('moderation_subject_status')
    .addColumn('convoId', 'varchar', (col) => col.notNull().defaultTo(''))
    .execute()

  // Update unique constraint
  // [did, recordPath] -> [did, recordPath, convoId]
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
}

export async function down(db: Kysely<unknown>): Promise<void> {
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

  await db.schema
    .alterTable('moderation_event')
    .dropColumn('subjectConvoId')
    .execute()
}
