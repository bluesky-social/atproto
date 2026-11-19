import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_credential_recipient')
    .renameColumn('serviceDid', 'service')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('space_credential_recipient')
    .renameColumn('service', 'serviceDid')
    .execute()
}
