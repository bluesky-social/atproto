import { Kysely } from 'kysely'
import { Dialect } from '..'

// Indexes to support efficient account deletion

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  /* Temporarily skipping index creation, will re-enable asap
  await db.schema // Also supports record deletes
    .createIndex('duplicate_record_duplicate_of_idx')
    .on('duplicate_record')
    .column('duplicateOf')
    .execute()
  await db.schema
    .createIndex('like_creator_idx')
    .on('like')
    .column('creator')
    .execute()
  await db.schema
    .createIndex('user_notification_author_idx')
    .on('user_notification')
    .column('author')
    .execute()
  */
  if (dialect !== 'sqlite') {
    // We want to keep record of the moderations actions even when deleting the underlying repo_blob record.
    await db.schema
      .alterTable('moderation_action_subject_blob')
      .dropConstraint('moderation_action_subject_blob_repo_blob_fkey')
      .execute()
  }
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect !== 'sqlite') {
    await db.schema
      .alterTable('moderation_action_subject_blob')
      .addForeignKeyConstraint(
        'moderation_action_subject_blob_repo_blob_fkey',
        ['cid', 'recordUri'],
        'repo_blob',
        ['cid', 'recordUri'],
      )
      .execute()
  }
  /* Temporarily skipping index creation, will re-enable asap
  await db.schema.dropIndex('user_notification_author_idx').execute()
  await db.schema.dropIndex('like_creator_idx').execute()
  await db.schema.dropIndex('duplicate_record_duplicate_of_idx').execute()
  */
}
