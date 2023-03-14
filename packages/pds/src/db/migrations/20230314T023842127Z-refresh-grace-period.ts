import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('refresh_token')
    .addColumn('nextId', 'varchar')
    .execute()
  await db.schema // Aids in refresh token cleanup
    .createIndex('refresh_token_did_idx')
    .on('refresh_token')
    .column('did')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('refresh_token_did_idx').execute()
  await db.schema.alterTable('refresh_token').dropColumn('nextId').execute()
}
