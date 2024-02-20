import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('actor')
    .addColumn('deactivatedAt', 'varchar')
    .execute()
  await db.schema
    .alterTable('actor')
    .addColumn('deleteAfter', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('actor').dropColumn('deactivatedAt').execute()
  await db.schema.alterTable('actor').dropColumn('deleteAfter').execute()
}
