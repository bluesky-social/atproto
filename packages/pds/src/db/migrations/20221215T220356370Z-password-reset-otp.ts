import { Kysely } from 'kysely'

const userTable = 'user'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable(userTable)
    .addColumn('passwordResetToken', 'varchar')
    .execute()
  await db.schema
    .alterTable(userTable)
    .addColumn('passwordResetGrantedAt', 'varchar')
    .execute()
  await db.schema
    .createIndex('user_password_reset_token_idx')
    .unique()
    .on('user')
    .column('passwordResetToken')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .dropIndex('user_password_reset_token_idx')
    .on('user')
    .execute()
  await db.schema
    .alterTable(userTable)
    .dropColumn('passwordResetToken')
    .execute()
  await db.schema
    .alterTable(userTable)
    .dropColumn('passwordResetGrantedAt')
    .execute()
}
