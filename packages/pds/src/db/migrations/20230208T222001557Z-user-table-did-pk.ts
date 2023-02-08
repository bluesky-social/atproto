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

  await db.schema.dropIndex('user_password_reset_token_idx').execute()
  await db.schema.dropTable('user').execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Migration code
}
