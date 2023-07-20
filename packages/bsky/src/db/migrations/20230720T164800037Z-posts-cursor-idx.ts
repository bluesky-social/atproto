import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('post_creator_cursor_idx')
    .on('post')
    .columns(['creator', 'sortAt', 'cid'])
    .execute()
  await db.schema.dropIndex('post_creator_idx').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('post_creator_idx')
    .on('post')
    .column('creator')
    .execute()
  await db.schema.dropIndex('post_creator_cursor_idx').execute()
}
