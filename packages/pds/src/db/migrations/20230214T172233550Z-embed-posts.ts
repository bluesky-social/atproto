import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('post_embed_post')
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('embedPostUri', 'varchar', (col) => col.notNull())
    .addColumn('embedPostCid', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('post_embed_post_pkey', [
      'postUri',
      'embedPostUri',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('post_embed_post').execute()
}
