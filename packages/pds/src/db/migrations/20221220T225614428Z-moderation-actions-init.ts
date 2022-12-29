import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  let builder = db.schema.createTable('moderation_action')
  builder =
    dialect === 'pg'
      ? builder.addColumn('id', 'serial', (col) => col.primaryKey())
      : builder.addColumn('id', 'integer', (col) =>
          col.autoIncrement().primaryKey(),
        )
  await builder
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('subjectType', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar')
    .addColumn('reason', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('reversedAt', 'varchar')
    .addColumn('reversedBy', 'varchar')
    .addColumn('reversedReason', 'text')
    .execute()
  await db.schema
    .alterTable('did_handle')
    .addColumn('takedownId', 'integer')
    .execute()
  if (dialect !== 'sqlite') {
    // Would have to recreate table in sqlite to add this constraint
    await db.schema
      .alterTable('did_handle')
      .addForeignKeyConstraint(
        'did_handle_takedown_id_fkey',
        ['takedownId'],
        'moderation_action',
        ['id'],
      )
      .execute()
  }
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect !== 'sqlite') {
    await db.schema
      .alterTable('did_handle')
      .dropConstraint('did_handle_takedown_id_fkey')
      .execute()
  }
  await db.schema.alterTable('did_handle').dropColumn('takedownId').execute()
  await db.schema.dropTable('moderation_action').execute()
}
