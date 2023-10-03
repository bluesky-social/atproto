import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

export async function up(db: Kysely<any>, dialect: Dialect): Promise<void> {
  // sequencer leader sequence
  if (dialect !== 'sqlite') {
    const res = await db
      .selectFrom('repo_seq')
      .select('seq')
      .where('seq', 'is not', null)
      .orderBy('seq', 'desc')
      .limit(1)
      .executeTakeFirst()
    const startAt = res?.seq ? res.seq + 50000 : 1
    await sql`CREATE SEQUENCE repo_seq_sequence START ${sql.literal(
      startAt,
    )};`.execute(db)
  }

  // user account cursor idx
  await db.schema
    .createIndex('user_account_cursor_idx')
    .on('user_account')
    .columns(['createdAt', 'did'])
    .execute()

  // invite note
  await db.schema
    .alterTable('user_account')
    .addColumn('inviteNote', 'varchar')
    .execute()

  // listing user invites
  await db.schema
    .createIndex('invite_code_for_user_idx')
    .on('invite_code')
    .column('forUser')
    .execute()

  // mod action duration
  await db.schema
    .alterTable('moderation_action')
    .addColumn('durationInHours', 'integer')
    .execute()
  await db.schema
    .alterTable('moderation_action')
    .addColumn('expiresAt', 'varchar')
    .execute()

  // runtime flag
  await db.schema
    .createTable('runtime_flag')
    .addColumn('name', 'varchar', (col) => col.primaryKey())
    .addColumn('value', 'varchar', (col) => col.notNull())
    .execute()

  // blob tempkey idx
  await db.schema
    .createIndex('blob_tempkey_idx')
    .on('blob')
    .column('tempKey')
    .execute()

  // repo v3
  await db.schema.alterTable('repo_root').addColumn('rev', 'varchar').execute()
  await db.schema.alterTable('record').addColumn('repoRev', 'varchar').execute()
  await db.schema
    .alterTable('ipld_block')
    .addColumn('repoRev', 'varchar')
    .execute()
  await db.schema
    .alterTable('repo_blob')
    .addColumn('repoRev', 'varchar')
    .execute()
  await db.schema.alterTable('repo_blob').dropColumn('commit').execute()

  await db.schema
    .createIndex('record_repo_rev_idx')
    .on('record')
    .columns(['did', 'repoRev'])
    .execute()

  await db.schema
    .createIndex('ipld_block_repo_rev_idx')
    .on('ipld_block')
    .columns(['creator', 'repoRev', 'cid'])
    .execute()

  await db.schema
    .createIndex('repo_blob_repo_rev_idx')
    .on('repo_blob')
    .columns(['did', 'repoRev'])
    .execute()

  await db.schema.dropTable('repo_commit_history').execute()
  await db.schema.dropTable('repo_commit_block').execute()
}

export async function down(
  db: Kysely<unknown>,
  dialect: Dialect,
): Promise<void> {
  // repo v3
  await db.schema
    .createTable('repo_commit_block')
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('block', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('repo_commit_block_pkey', [
      'creator',
      'commit',
      'block',
    ])
    .execute()
  await db.schema
    .createTable('repo_commit_history')
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('prev', 'varchar')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('repo_commit_history_pkey', ['creator', 'commit'])
    .execute()

  await db.schema.dropIndex('record_repo_rev_idx').execute()
  await db.schema.dropIndex('ipld_block_repo_rev_idx').execute()
  await db.schema.dropIndex('repo_blob_repo_rev_idx').execute()

  await db.schema.alterTable('repo_root').dropColumn('rev').execute()
  await db.schema.alterTable('record').dropColumn('repoRev').execute()
  await db.schema.alterTable('ipld_block').dropColumn('repoRev').execute()
  await db.schema.alterTable('repo_blob').dropColumn('repoRev').execute()
  await db.schema
    .alterTable('repo_blob')
    .addColumn('commit', 'varchar')
    .execute()

  // blob tempkey idx
  await db.schema.dropIndex('blob_tempkey_idx').execute()

  // runtime flag
  await db.schema.dropTable('runtime_flag').execute()

  // mod action duration
  await db.schema
    .alterTable('moderation_action')
    .dropColumn('durationInHours')
    .execute()
  await db.schema
    .alterTable('moderation_action')
    .dropColumn('expiresAt')
    .execute()

  // listing user invites
  await db.schema.dropIndex('invite_code_for_user_idx').execute()

  // invite note
  await db.schema.alterTable('user_account').dropColumn('inviteNote').execute()

  // user account cursor idx
  await db.schema.dropIndex('user_account_cursor_idx').execute()

  // sequencer leader sequence
  if (dialect !== 'sqlite') {
    await sql`DROP SEQUENCE repo_seq_sequence;`.execute(db)
  }
}
