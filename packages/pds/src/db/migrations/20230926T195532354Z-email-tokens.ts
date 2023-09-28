import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  const timestamp = dialect === 'sqlite' ? 'datetime' : 'timestamptz'
  await db.schema
    .createTable('email_token')
    .addColumn('purpose', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('token', 'varchar', (col) => col.notNull())
    .addColumn('requestedAt', timestamp, (col) => col.notNull())
    .addPrimaryKeyConstraint('email_token_pkey', ['purpose', 'did'])
    .addUniqueConstraint('email_token_purpose_token_unique', [
      'purpose',
      'token',
    ])
    .execute()

  await db.schema
    .alterTable('user_account')
    .addColumn('emailConfirmedAt', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('email_token').execute()
  await db.schema
    .alterTable('user_account')
    .dropColumn('emailConfirmedAt')
    .execute()
}
