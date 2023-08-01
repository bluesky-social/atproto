import { Kysely } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  if (dialect === 'sqlite') {
    return
  }
  await db.schema
    .alterTable('repo_root')
    .dropConstraint('repo_root_takedown_id_fkey')
    .execute()
  await db.schema
    .alterTable('record')
    .dropConstraint('record_takedown_id_fkey')
    .execute()
  await db.schema
    .alterTable('repo_blob')
    .dropConstraint('repo_blob_takedown_id_fkey')
    .execute()
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  if (dialect === 'sqlite') {
    return
  }
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
