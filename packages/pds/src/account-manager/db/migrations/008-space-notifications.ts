import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('space_notification_retry')
    .addColumn('repo', 'varchar', (col) => col.notNull())
    .addColumn('space', 'varchar', (col) => col.notNull())
    .addColumn('repoRev', 'varchar', (col) => col.notNull())
    .addColumn('hash', 'blob', (col) => col.notNull())
    .addColumn('attempts', 'integer', (col) => col.notNull())
    .addColumn('retryAt', 'integer', (col) => col.notNull())
    .addColumn('expiresAt', 'integer', (col) => col.notNull())
    .addPrimaryKeyConstraint('space_notification_retry_pkey', ['repo', 'space'])
    .execute()
  await db.schema
    .createIndex('space_notification_retry_at_idx')
    .on('space_notification_retry')
    .column('retryAt')
    .execute()
  await db.schema
    .createTable('space_notification_lease')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('owner', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'integer', (col) => col.notNull())
    .execute()
  await sql`
    insert into space_notification_lease (id, owner, expiresAt) values (1, '', 0)
  `.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('space_notification_lease').execute()
  await db.schema.dropTable('space_notification_retry').execute()
}
