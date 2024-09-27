import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('profile')
    .addColumn('pinnedPost', 'varchar')
    .execute()
  await db.schema
    .alterTable('profile')
    .addColumn('pinnedPostCid', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('profile').dropColumn('pinnedPost').execute()
  await db.schema.alterTable('profile').dropColumn('pinnedPostCid').execute()
}
