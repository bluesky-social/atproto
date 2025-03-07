import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('member').addColumn('handle', 'text').execute()
  await db.schema
    .alterTable('member')
    .addColumn('displayName', 'text')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('member').dropColumn('handle').execute()
  await db.schema.alterTable('member').dropColumn('displayName').execute()
}
