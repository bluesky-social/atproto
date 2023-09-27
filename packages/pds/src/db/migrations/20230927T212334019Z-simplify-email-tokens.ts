import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('user_account')
    .dropColumn('passwordResetToken')
    .execute()

  await db.schema
    .alterTable('user_account')
    .dropColumn('passwordResetGrantedAt')
    .execute()

  await db.schema.dropTable('delete_account_token').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('user_account')
    .addColumn('passwordResetToken', 'varchar')
    .execute()

  await db.schema
    .alterTable('user_account')
    .addColumn('passwordResetGrantedAt', 'varchar')
    .execute()

  await db.schema
    .createTable('delete_account_token')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('token', 'varchar', (col) => col.notNull())
    .addColumn('requestedAt', 'varchar', (col) => col.notNull())
    .execute()
}
