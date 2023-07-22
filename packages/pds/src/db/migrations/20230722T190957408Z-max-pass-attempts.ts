import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('user_account')
    .addColumn('signupIpAddr', 'varchar')
    .execute()
  await db.schema
    .alterTable('user_account')
    .addColumn('loginAttemptAt', 'varchar')
    .execute()
  await db.schema
    .alterTable('user_account')
    .addColumn('loginAttemptCount', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('user_account')
    .dropColumn('signupIpAddr')
    .execute()
  await db.schema
    .alterTable('user_account')
    .dropColumn('loginAttemptAt')
    .execute()
  await db.schema
    .alterTable('user_account')
    .dropColumn('loginAttemptCount')
    .execute()
}
