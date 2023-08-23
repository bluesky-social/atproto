import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('notification_push_token')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('platform', 'varchar', (col) => col.notNull())
    .addColumn('token', 'varchar', (col) => col.notNull())
    .addColumn('appId', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('notification_push_token_pkey', ['did', 'token'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('notification_push_token').execute()
}
