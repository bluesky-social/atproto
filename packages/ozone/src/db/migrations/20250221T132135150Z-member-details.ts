import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('member').addColumn('handle', 'text').execute()
  await db.schema
    .alterTable('member')
    .addColumn('displayName', 'text')
    .execute()
  await db.schema
    .createIndex('member_display_name_idx')
    .on('member')
    .column('displayName')
    .execute()
  await db.schema
    .createIndex('member_handle_idx')
    .on('member')
    .column('handle')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('member').dropColumn('handle').execute()
  await db.schema.alterTable('member').dropColumn('displayName').execute()
}
