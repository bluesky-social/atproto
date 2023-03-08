import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('post_embed_record')
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('embedUri', 'varchar', (col) => col.notNull())
    .addColumn('embedCid', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('post_embed_record_pkey', ['postUri', 'embedUri'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('post_embed_record').execute()
}
