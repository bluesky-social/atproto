import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createIndex('user_account_cursor_idx')
    .on('user_account')
    .columns(['createdAt', 'did'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('user_account_cursor_idx').execute()
}
