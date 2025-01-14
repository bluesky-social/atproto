import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('starter_pack')
    .addColumn('name', 'varchar')
    .execute()

  await db.schema // Supports starter pack search
    .createIndex(`starter_pack_name_tgrm_idx`)
    .on('starter_pack')
    .using('gist')
    .expression(sql`"name" gist_trgm_ops`)
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('starter_pack').dropColumn('name').execute()
}
