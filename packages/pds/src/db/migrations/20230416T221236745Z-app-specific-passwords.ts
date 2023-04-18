import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('refresh_token')
    .addColumn('appPasswordName', 'varchar')
    .execute()

  await db.schema
    .createTable('app_password')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('passwordScrypt', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('app_password_pkey', ['did', 'name'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('app_password').execute()

  await db.schema
    .alterTable('refresh_token')
    .dropColumn('appPasswordName')
    .execute()
}
