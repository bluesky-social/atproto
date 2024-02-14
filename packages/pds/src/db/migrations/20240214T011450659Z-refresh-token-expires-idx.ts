import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('refresh_token_did_expires_at_idx')
    .on('refresh_token')
    .columns(['did', 'expiresAt'])
    .execute()
  await db.schema.dropIndex('refresh_token_did_idx').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('refresh_token_did_idx')
    .on('refresh_token')
    .column('did')
    .execute()
  await db.schema.dropIndex('refresh_token_did_expires_at_idx').execute()
}
