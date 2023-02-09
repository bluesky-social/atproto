import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user_account')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('email', 'varchar', (col) => col.notNull().unique())
    .addColumn('password', 'varchar', (col) => col.notNull())
    .addColumn('lastSeenNotifs', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('passwordResetToken', 'varchar')
    .addColumn('passwordResetGrantedAt', 'varchar')
    .execute()

  await db
    .insertInto('user_account')
    .columns([
      'did',
      'email',
      'password',
      'lastSeenNotifs',
      'createdAt',
      'passwordResetToken',
      'passwordResetGrantedAt',
    ])
    .expression((exp) =>
      exp
        .selectFrom('user')
        .innerJoin('did_handle', 'did_handle.handle', 'user.handle')
        .select([
          'did_handle.did',
          'user.email',
          'user.password',
          'user.lastSeenNotifs',
          'user.createdAt',
          'user.passwordResetToken',
          'user.passwordResetGrantedAt',
        ]),
    )
    .execute()

  await db.schema
    .createIndex('user_account_password_reset_token_idx')
    .unique()
    .on('user_account')
    .column('passwordResetToken')
    .execute()

  await db.schema.dropIndex('user_password_reset_token_idx').execute()
  await db.schema.dropTable('user').execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user')
    .addColumn('handle', 'varchar', (col) => col.primaryKey())
    .addColumn('email', 'varchar', (col) => col.notNull().unique())
    .addColumn('password', 'varchar', (col) => col.notNull())
    .addColumn('lastSeenNotifs', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('passwordResetToken', 'varchar')
    .addColumn('passwordResetGrantedAt', 'varchar')
    .execute()

  await db
    .insertInto('user')
    .columns([
      'handle',
      'email',
      'password',
      'lastSeenNotifs',
      'createdAt',
      'passwordResetToken',
      'passwordResetGrantedAt',
    ])
    .expression((exp) =>
      exp
        .selectFrom('user_account')
        .innerJoin('did_handle', 'did_handle.did', 'user_account.did')
        .select([
          'did_handle.handle',
          'user_account.email',
          'user_account.password',
          'user_account.lastSeenNotifs',
          'user_account.createdAt',
          'user_account.passwordResetToken',
          'user_account.passwordResetGrantedAt',
        ]),
    )
    .execute()

  await db.schema
    .createIndex('user_password_reset_token_idx')
    .unique()
    .on('user')
    .column('passwordResetToken')
    .execute()

  await db.schema.dropIndex('user_account_password_reset_token_idx').execute()
  await db.schema.dropTable('user_account').execute()
}
