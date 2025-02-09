import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // postEmbedVideo
  await db.schema
    .createTable('post_embed_video')
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('videoCid', 'varchar', (col) => col.notNull())
    .addColumn('alt', 'varchar')
    .addPrimaryKeyConstraint('post_embed_video_pkey', ['postUri'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // postEmbedVideo
  await db.schema.dropTable('post_embed_video').execute()
}
