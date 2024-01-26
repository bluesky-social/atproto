import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('like_creator_cursor_idx')
    .on('like')
    .columns(['creator', 'sortAt', 'cid'])
    .execute()
  await db.schema
    .createIndex('follow_creator_cursor_idx')
    .on('follow')
    .columns(['creator', 'sortAt', 'cid'])
    .execute()
  await db.schema
    .createIndex('follow_subject_cursor_idx')
    .on('follow')
    .columns(['subjectDid', 'sortAt', 'cid'])
    .execute()

  // drop old indices that are superseded by these
  await db.schema.dropIndex('like_creator_idx').execute()
  await db.schema.dropIndex('follow_subjectdid_idx').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('like_creator_idx')
    .on('like')
    .column('creator')
    .execute()
  await db.schema
    .createIndex('follow_subjectdid_idx')
    .on('follow')
    .column('subjectDid')
    .execute()

  await db.schema.dropIndex('like_creator_cursor_idx').execute()
  await db.schema.dropIndex('follow_creator_cursor_idx').execute()
  await db.schema.dropIndex('follow_subject_cursor_idx').execute()
}
