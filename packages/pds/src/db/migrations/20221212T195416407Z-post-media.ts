import { Kysely } from 'kysely'

const postEmbedImageTable = 'post_embed_image'
const postEmbedExternalTable = 'post_embed_external'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(postEmbedImageTable)
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('position', 'varchar', (col) => col.notNull())
    .addColumn('imageCid', 'varchar', (col) => col.notNull())
    .addColumn('alt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`${postEmbedImageTable}_pkey`, [
      'postUri',
      'position',
    ])
    .execute()
  await db.schema
    .createTable(postEmbedExternalTable)
    .addColumn('postUri', 'varchar', (col) => col.primaryKey())
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('title', 'varchar', (col) => col.notNull())
    .addColumn('description', 'varchar', (col) => col.notNull())
    .addColumn('thumbCid', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(postEmbedExternalTable).execute()
  await db.schema.dropTable(postEmbedImageTable).execute()
}
