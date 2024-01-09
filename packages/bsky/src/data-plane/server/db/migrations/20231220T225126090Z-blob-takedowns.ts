import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('blob_takedown')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('takedownRef', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('blob_takedown_pkey', ['did', 'cid'])
    .execute()

  await db.schema
    .alterTable('actor')
    .dropConstraint('actor_takedown_id_fkey')
    .execute()
  await db.schema.alterTable('actor').dropColumn('takedownId').execute()
  await db.schema
    .alterTable('actor')
    .addColumn('takedownRef', 'varchar')
    .execute()

  await db.schema
    .alterTable('record')
    .dropConstraint('record_takedown_id_fkey')
    .execute()
  await db.schema.alterTable('record').dropColumn('takedownId').execute()
  await db.schema
    .alterTable('record')
    .addColumn('takedownRef', 'varchar')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('blob_takedown').execute()

  await db.schema.alterTable('actor').dropColumn('takedownRef').execute()
  await db.schema
    .alterTable('actor')
    .addColumn('takedownId', 'integer')
    .execute()

  await db.schema
    .alterTable('actor')
    .addForeignKeyConstraint(
      'actor_takedown_id_fkey',
      ['takedownId'],
      'moderation_event',
      ['id'],
    )
    .execute()

  await db.schema.alterTable('record').dropColumn('takedownRef').execute()
  await db.schema
    .alterTable('record')
    .addColumn('takedownId', 'integer')
    .execute()
  await db.schema
    .alterTable('record')
    .addForeignKeyConstraint(
      'record_takedown_id_fkey',
      ['takedownId'],
      'moderation_event',
      ['id'],
    )
    .execute()
}
