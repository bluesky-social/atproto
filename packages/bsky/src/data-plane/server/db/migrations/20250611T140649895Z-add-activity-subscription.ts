import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('activity_subscription')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('key', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('post', 'boolean', (col) => col.notNull())
    .addColumn('reply', 'boolean', (col) => col.notNull())
    .addPrimaryKeyConstraint('activity_subscription_pkey', [
      'creator',
      'subjectDid',
    ])
    .execute()
  await db.schema
    .createIndex('activity_subscription_creator_key_idx')
    .on('activity_subscription')
    .columns(['creator', 'key'])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('activity_subscription').execute()
}
