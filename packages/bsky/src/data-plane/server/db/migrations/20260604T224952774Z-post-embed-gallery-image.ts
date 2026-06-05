import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // postEmbedGalleryImage
  //
  // Mirrors the shape of the legacy post_embed_image table, including its
  // `position varchar` column. Postgres coerces the inserted numeric values,
  // and using the same type avoids surprising callers that already accept
  // either representation. Lexicographic ordering of the PK is acceptable
  // because we never read items by position-range; we always select all rows
  // for a given postUri and let the indexer-side `position: i` index drive
  // ordering.
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
  // postEmbedGalleryImage
  await db.schema.dropTable('post_embed_gallery_image').execute()
}
