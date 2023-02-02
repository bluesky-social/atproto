import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  // Track relevant subject blobs on action
  await db.schema
    .createTable('moderation_action_subject_blob')
    .addColumn('actionId', 'integer', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('recordUri', 'varchar', (col) => col.notNull())
    .addForeignKeyConstraint(
      'moderation_action_subject_blob_action_id_fkey',
      ['actionId'],
      'moderation_action',
      ['id'],
    )
    .addForeignKeyConstraint(
      'moderation_action_subject_blob_repo_blob_fkey',
      ['cid', 'recordUri'],
      'repo_blob',
      ['cid', 'recordUri'],
    )
    .addPrimaryKeyConstraint('moderation_action_subject_blob_pkey', [
      'actionId',
      'cid',
      'recordUri',
    ])
    .execute()
  // Blob takedowns
  await db.schema
    .alterTable('repo_blob')
    .addColumn('takedownId', 'integer')
    .execute()
  if (dialect !== 'sqlite') {
    // Would have to recreate table in sqlite to add these constraints
    await db.schema
      .alterTable('repo_blob')
      .addForeignKeyConstraint(
        'repo_blob_takedown_id_fkey',
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
  await db.schema.dropTable('moderation_action_subject_blob').execute()
  if (dialect !== 'sqlite') {
    await db.schema
      .alterTable('repo_blob')
      .dropConstraint('repo_blob_takedown_id_fkey')
      .execute()
  }
  await db.schema.alterTable('repo_blob').dropColumn('takedownId').execute()
}
