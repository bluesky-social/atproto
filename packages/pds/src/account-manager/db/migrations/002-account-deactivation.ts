import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('account')
    .addColumn('deactivatedAt', 'varchar')
    .execute()
  await db.schema
    .alterTable('account')
    .addColumn('deleteAfter', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('account').dropColumn('deactivatedAt').execute()
  await db.schema.alterTable('account').dropColumn('deleteAfter').execute()
}
