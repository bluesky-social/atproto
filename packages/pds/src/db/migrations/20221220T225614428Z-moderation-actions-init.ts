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
  builder = builder
    .addColumn('action', 'varchar', (col) => col.notNull())
    .addColumn('subjectType', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar')
    .addColumn('subjectDeclarationCid', 'varchar')
    .addColumn('rationale', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('reversedAt', 'varchar')
    .addColumn('reversedBy', 'varchar')
    .addColumn('reversedRationale', 'text')
  await builder.execute()
  await db.schema.alterTable('did_handle').addColumn('takedownId', 'integer')
  await db.schema
    .alterTable('did_handle')
    .addForeignKeyConstraint(
      'did_handle_takedown_id_fkey',
      ['takedownId'],
      'moderation_action',
      ['id'],
    )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('did_handle')
    .dropConstraint('did_handle_takedown_id_fkey')
  await db.schema.alterTable('did_handle').dropColumn('takedownId')
  await db.schema.dropTable('moderation_action').execute()
}
