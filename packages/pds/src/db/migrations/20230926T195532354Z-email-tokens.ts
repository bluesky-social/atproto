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

  await db.schema.dropIndex('user_account_password_reset_token_idx').execute()

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
  await db.schema.dropTable('email_token').execute()
  await db.schema
    .alterTable('user_account')
    .dropColumn('emailConfirmedAt')
    .execute()

  await db.schema
    .createIndex('user_account_password_reset_token_idx')
    .unique()
    .on('user_account')
    .column('passwordResetToken')
    .execute()

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
