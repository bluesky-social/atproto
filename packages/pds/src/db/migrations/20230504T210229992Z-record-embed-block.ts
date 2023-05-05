import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('post')
    .addColumn('replyBlocked', 'int2', (col) => col.defaultTo(0).notNull())
    .execute()
  await db.schema
    .alterTable('post_embed_record')
    .addColumn('blocked', 'int2', (col) => col.defaultTo(0).notNull())
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('post').dropColumn('replyBlocked').execute()
  await db.schema
    .alterTable('post_embed_record')
    .dropColumn('blocked')
    .execute()
}
