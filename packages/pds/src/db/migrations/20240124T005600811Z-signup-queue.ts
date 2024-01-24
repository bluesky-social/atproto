import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('user_account')
    .addColumn('activatedAt', 'varchar')
    .execute()
  await db.schema
    .createIndex('user_account_activated_at_idx')
    .on('user_account')
    .columns(['activatedAt', 'createdAt'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('user_account_activated_at_idx').execute()
  await db.schema.alterTable('user_account').dropColumn('activatedAt').execute()
}
