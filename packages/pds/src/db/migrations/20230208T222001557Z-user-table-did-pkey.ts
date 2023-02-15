import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // create switch user -> user_account with did primaryKey
  await db.schema
    .createTable('user_account')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('email', 'varchar', (col) => col.notNull().unique())
    .addColumn('passwordScrypt', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('passwordResetToken', 'varchar')
    .addColumn('passwordResetGrantedAt', 'varchar')
    .execute()
  await db
    .insertInto('user_account')
    .columns([
      'did',
      'email',
      'passwordScrypt',
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
          'user.createdAt',
          'user.passwordResetToken',
          'user.passwordResetGrantedAt',
        ]),
    )
    .execute()

  // add indices
  await db.schema
    .createIndex(`user_account_email_lower_idx`)
    .unique()
    .on('user_account')
    .expression(sql`lower("email")`)
    .execute()
  await db.schema
    .createIndex('user_account_password_reset_token_idx')
    .unique()
    .on('user_account')
    .column('passwordResetToken')
    .execute()

  // move notifsLastSeen to a new user_state table
  await db.schema
    .createTable('user_state')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('lastSeenNotifs', 'varchar', (col) => col.notNull())
    .execute()
  await db
    .insertInto('user_state')
    .columns(['did', 'lastSeenNotifs'])
    .expression((exp) =>
      exp
        .selectFrom('user')
        .innerJoin('did_handle', 'did_handle.handle', 'user.handle')
        .select(['did_handle.did', 'user.lastSeenNotifs']),
    )
    .execute()

  // drop old tables & indices
  await db.schema.dropIndex('user_email_lower_idx').execute()
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
        .innerJoin('user_state', 'user_state.did', 'did_handle.did')
        .select([
          'did_handle.handle',
          'user_account.email',
          'user_account.passwordScrypt',
          'user_state.lastSeenNotifs',
          'user_account.createdAt',
          'user_account.passwordResetToken',
          'user_account.passwordResetGrantedAt',
        ]),
    )
    .execute()

  await db.schema
    .createIndex(`user_email_lower_idx`)
    .unique()
    .on('user')
    .expression(sql`lower("email")`)
    .execute()
  await db.schema
    .createIndex('user_password_reset_token_idx')
    .unique()
    .on('user')
    .column('passwordResetToken')
    .execute()

  await db.schema.dropTable('user_state').execute()
  await db.schema.dropIndex('user_account_email_lower_idx').execute()
  await db.schema.dropIndex('user_account_password_reset_token_idx').execute()
  await db.schema.dropTable('user_account').execute()
}
