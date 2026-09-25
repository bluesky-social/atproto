import type { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('inbox_notification')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('recipientDid', 'varchar', (col) => col.notNull())
    .addColumn('reason', 'varchar', (col) => col.notNull())
    .addColumn('section', 'varchar', (col) => col.notNull())
    .addColumn('target', 'jsonb', (col) => col.notNull())
    .addColumn('body', 'text')
    .addColumn('sourceKey', 'varchar', (col) => col.notNull().unique())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createIndex('idx_inbox_notification_recipient_created')
    .on('inbox_notification')
    .columns(['recipientDid', 'createdAt', 'id'])
    .execute()
  await db.schema
    .createIndex('idx_inbox_notification_recipient_section_created')
    .on('inbox_notification')
    .columns(['recipientDid', 'section', 'createdAt', 'id'])
    .execute()
  await db.schema
    .createTable('inbox_notification_preference')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('push', 'boolean', (col) => col.notNull().defaultTo(true))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('inbox_notification_preference').execute()
  await db.schema.dropTable('inbox_notification').execute()
}
