import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('post_embed_gallery_image')
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('position', 'varchar', (col) => col.notNull())
    .addColumn('imageCid', 'varchar', (col) => col.notNull())
    .addColumn('alt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('post_embed_gallery_image_pkey', [
      'postUri',
      'position',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('post_embed_gallery_image').execute()
}
