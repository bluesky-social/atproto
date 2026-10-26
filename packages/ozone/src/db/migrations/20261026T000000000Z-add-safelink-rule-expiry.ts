import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('safelink_rule')
    .addColumn('expiresAt', 'varchar')
    .execute()

  await db.schema
    .alterTable('safelink_event')
    .addColumn('expiresAt', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('safelink_event').dropColumn('expiresAt').execute()
  await db.schema.alterTable('safelink_rule').dropColumn('expiresAt').execute()
}
