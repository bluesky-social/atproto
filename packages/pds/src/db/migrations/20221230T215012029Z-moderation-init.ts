import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  // Moderation action
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
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar')
    .addColumn('subjectCid', 'varchar')
    .addColumn('reason', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('reversedAt', 'varchar')
    .addColumn('reversedBy', 'varchar')
    .addColumn('reversedReason', 'text')
    .execute()
  // Repo takedowns
  await db.schema
    .alterTable('repo_root')
    .addColumn('takedownId', 'integer')
    .execute()
  // Record takedowns
  await db.schema
    .alterTable('record')
    .addColumn('takedownId', 'integer')
    .execute()
  if (dialect !== 'sqlite') {
    // Would have to recreate table in sqlite to add these constraints
    await db.schema
      .alterTable('repo_root')
      .addForeignKeyConstraint(
        'repo_root_takedown_id_fkey',
        ['takedownId'],
        'moderation_action',
        ['id'],
      )
      .execute()
    await db.schema
      .alterTable('record')
      .addForeignKeyConstraint(
        'record_takedown_id_fkey',
        ['takedownId'],
        'moderation_action',
        ['id'],
      )
      .execute()
  }
  // Moderation report
  builder = db.schema.createTable('moderation_report')
  builder =
    dialect === 'pg'
      ? builder.addColumn('id', 'serial', (col) => col.primaryKey())
      : builder.addColumn('id', 'integer', (col) =>
          col.autoIncrement().primaryKey(),
        )
  await builder
    .addColumn('subjectType', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar')
    .addColumn('subjectCid', 'varchar')
    .addColumn('reasonType', 'varchar', (col) => col.notNull())
    .addColumn('reason', 'text')
    .addColumn('reportedByDid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
  // Moderation report resolutions
  await db.schema
    .createTable('moderation_report_resolution')
    .addColumn('reportId', 'integer', (col) =>
      col.notNull().references('moderation_report.id'),
    )
    .addColumn('actionId', 'integer', (col) =>
      col.notNull().references('moderation_action.id'),
    )
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('moderation_report_resolution_pkey', [
      'reportId',
      'actionId',
    ])
    .execute()
  await db.schema
    .createIndex('moderation_report_resolution_action_id_idx')
    .on('moderation_report_resolution')
    .column('actionId')
    .execute()
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  await db.schema.dropTable('moderation_report_resolution').execute()
  await db.schema.dropTable('moderation_report').execute()
  if (dialect !== 'sqlite') {
    await db.schema
      .alterTable('repo_root')
      .dropConstraint('repo_root_takedown_id_fkey')
      .execute()
    await db.schema
      .alterTable('record')
      .dropConstraint('record_takedown_id_fkey')
      .execute()
  }
  await db.schema.alterTable('repo_root').dropColumn('takedownId').execute()
  await db.schema.alterTable('record').dropColumn('takedownId').execute()
  await db.schema.dropTable('moderation_action').execute()
}
