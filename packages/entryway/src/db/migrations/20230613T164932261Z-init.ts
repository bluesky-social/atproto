import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

// @TODO make takedownId a varchar w/o fkey?

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  const binaryDatatype = dialect === 'sqlite' ? 'blob' : sql`bytea`

  await db.schema
    .createTable('app_migration')
    .addColumn('id', 'varchar', (col) => col.primaryKey())
    .addColumn('success', 'int2', (col) => col.notNull().defaultTo(0))
    .addColumn('completedAt', 'varchar', (col) => col)
    .execute()

  await db.schema
    .createTable('app_password')
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('passwordScrypt', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('app_password_pkey', ['did', 'name'])
    .execute()

  await db.schema
    .createTable('backlink')
    .addColumn('uri', 'varchar', (col) => col.notNull())
    .addColumn('path', 'varchar', (col) => col.notNull())
    .addColumn('linkToUri', 'varchar')
    .addColumn('linkToDid', 'varchar')
    .addPrimaryKeyConstraint('backlinks_pkey', ['uri', 'path'])
    .addCheckConstraint(
      'backlink_link_to_chk',
      // Exactly one of linkToUri or linkToDid should be set
      sql`("linkToUri" is null and "linkToDid" is not null) or ("linkToUri" is not null and "linkToDid" is null)`,
    )
    .execute()
  await db.schema
    .createIndex('backlink_path_to_uri_idx')
    .on('backlink')
    .columns(['path', 'linkToUri'])
    .execute()
  await db.schema
    .createIndex('backlink_path_to_did_idx')
    .on('backlink')
    .columns(['path', 'linkToDid'])
    .execute()

  await db.schema
    .createTable('blob')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('mimeType', 'varchar', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('tempKey', 'varchar')
    .addColumn('width', 'integer')
    .addColumn('height', 'integer')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('blob_pkey', ['creator', 'cid'])
    .execute()

  await db.schema
    .createTable('delete_account_token')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('token', 'varchar', (col) => col.notNull())
    .addColumn('requestedAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('did_cache')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('doc', 'text', (col) => col.notNull())
    .addColumn('updatedAt', 'bigint', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('did_handle')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('handle', 'varchar', (col) => col.unique())
    .execute()
  await db.schema
    .createIndex(`did_handle_handle_lower_idx`)
    .unique()
    .on('did_handle')
    .expression(sql`lower("handle")`)
    .execute()

  await db.schema
    .createTable('invite_code')
    .addColumn('code', 'varchar', (col) => col.primaryKey())
    .addColumn('availableUses', 'integer', (col) => col.notNull())
    .addColumn('disabled', 'int2', (col) => col.defaultTo(0))
    .addColumn('forUser', 'varchar', (col) => col.notNull())
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()

  await db.schema
    .createTable('invite_code_use')
    .addColumn('code', 'varchar', (col) => col.notNull())
    .addColumn('usedBy', 'varchar', (col) => col.notNull())
    .addColumn('usedAt', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`invite_code_use_pkey`, ['code', 'usedBy'])
    .execute()

  await db.schema
    .createTable('ipld_block')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('content', binaryDatatype, (col) => col.notNull())
    .addPrimaryKeyConstraint('ipld_block_pkey', ['creator', 'cid'])
    .execute()

  const moderationActionBuilder =
    dialect === 'pg'
      ? db.schema
          .createTable('moderation_action')
          .addColumn('id', 'serial', (col) => col.primaryKey())
      : db.schema
          .createTable('moderation_action')
          .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
  await moderationActionBuilder
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
    .addColumn('createLabelVals', 'varchar')
    .addColumn('negateLabelVals', 'varchar')
    .execute()

  await db.schema
    .createTable('moderation_action_subject_blob')
    .addColumn('actionId', 'integer', (col) =>
      col.notNull().references('moderation_action.id'),
    )
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('recordUri', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('moderation_action_subject_blob_pkey', [
      'actionId',
      'cid',
      'recordUri',
    ])
    .execute()

  const moderationReportBuilder =
    dialect === 'pg'
      ? db.schema
          .createTable('moderation_report')
          .addColumn('id', 'serial', (col) => col.primaryKey())
      : db.schema
          .createTable('moderation_report')
          .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
  await moderationReportBuilder
    .addColumn('subjectType', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectUri', 'varchar')
    .addColumn('subjectCid', 'varchar')
    .addColumn('reasonType', 'varchar', (col) => col.notNull())
    .addColumn('reason', 'text')
    .addColumn('reportedByDid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()

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

  await db.schema
    .createTable('record')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('takedownId', 'varchar')
    .execute()
  await db.schema
    .createIndex('record_did_cid_idx')
    .on('record')
    .columns(['did', 'cid'])
    .execute()
  await db.schema
    .createIndex('record_did_collection_idx')
    .on('record')
    .columns(['did', 'collection'])
    .execute()

  await db.schema
    .createTable('refresh_token')
    .addColumn('id', 'varchar', (col) => col.primaryKey())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .addColumn('nextId', 'varchar')
    .addColumn('appPasswordName', 'varchar')
    .execute()
  await db.schema // Aids in refresh token cleanup
    .createIndex('refresh_token_did_idx')
    .on('refresh_token')
    .column('did')
    .execute()

  await db.schema
    .createTable('repo_blob')
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('recordUri', 'varchar', (col) => col.notNull())
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('takedownId', 'varchar')
    .addPrimaryKeyConstraint(`repo_blob_pkey`, ['cid', 'recordUri'])
    .execute()
  await db.schema // supports rebase
    .createIndex('repo_blob_did_idx')
    .on('repo_blob')
    .column('did')
    .execute()

  await db.schema
    .createTable('repo_commit_block')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('block', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint('repo_commit_block_pkey', [
      'creator',
      'commit',
      'block',
    ])
    .execute()

  await db.schema
    .createTable('repo_commit_history')
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('commit', 'varchar', (col) => col.notNull())
    .addColumn('prev', 'varchar')
    .addPrimaryKeyConstraint('repo_commit_history_pkey', ['creator', 'commit'])
    .execute()

  await db.schema
    .createTable('repo_root')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('root', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('takedownId', 'varchar')
    .execute()

  // @TODO renamed indexes for consistency
  const repoSeqBuilder =
    dialect === 'pg'
      ? db.schema
          .createTable('repo_seq')
          .addColumn('id', 'bigserial', (col) => col.primaryKey())
          .addColumn('seq', 'bigint', (col) => col.unique())
      : db.schema
          .createTable('repo_seq')
          .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
          .addColumn('seq', 'integer', (col) => col.unique())
  await repoSeqBuilder
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('eventType', 'varchar', (col) => col.notNull())
    .addColumn('event', binaryDatatype, (col) => col.notNull())
    .addColumn('invalidated', 'int2', (col) => col.notNull().defaultTo(0))
    .addColumn('sequencedAt', 'varchar', (col) => col.notNull())
    .execute()
  // for filtering seqs based on did
  await db.schema
    .createIndex('repo_seq_did_idx')
    .on('repo_seq')
    .column('did')
    .execute()
  // for filtering seqs based on event type
  await db.schema
    .createIndex('repo_seq_event_type_idx')
    .on('repo_seq')
    .column('eventType')
    .execute()
  // for entering into the seq stream at a particular time
  await db.schema
    .createIndex('repo_seq_sequenced_at_index')
    .on('repo_seq')
    .column('sequencedAt')
    .execute()

  await db.schema
    .createTable('user_account')
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('email', 'varchar', (col) => col.notNull())
    .addColumn('passwordScrypt', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('passwordResetToken', 'varchar')
    .addColumn('passwordResetGrantedAt', 'varchar')
    .addColumn('invitesDisabled', 'int2', (col) => col.notNull().defaultTo(0))
    .execute()
  await db.schema
    .createIndex(`user_account_email_lower_idx`)
    .unique()
    .on('user_account')
    .expression(sql`lower("email")`)
    .execute()
  await db.schema
    .createIndex('user_account_password_reset_token_idx')
    .unique()
    .on('user_account')
    .column('passwordResetToken')
    .execute()

  const userPrefBuilder =
    dialect === 'pg'
      ? db.schema
          .createTable('user_pref')
          .addColumn('id', 'bigserial', (col) => col.primaryKey())
      : db.schema
          .createTable('user_pref')
          .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey())
  await userPrefBuilder
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('valueJson', 'text', (col) => col.notNull())
    .execute()
  await db.schema
    .createIndex('user_pref_did_idx')
    .on('user_pref')
    .column('did')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('user_pref').execute()
  await db.schema.dropTable('user_account').execute()
  await db.schema.dropTable('repo_seq').execute()
  await db.schema.dropTable('repo_root').execute()
  await db.schema.dropTable('repo_commit_history').execute()
  await db.schema.dropTable('repo_commit_block').execute()
  await db.schema.dropTable('repo_blob').execute()
  await db.schema.dropTable('refresh_token').execute()
  await db.schema.dropTable('record').execute()
  await db.schema.dropTable('moderation_report_resolution').execute()
  await db.schema.dropTable('moderation_report').execute()
  await db.schema.dropTable('moderation_action_subject_blob').execute()
  await db.schema.dropTable('moderation_action').execute()
  await db.schema.dropTable('ipld_block').execute()
  await db.schema.dropTable('invite_code_use').execute()
  await db.schema.dropTable('invite_code').execute()
  await db.schema.dropTable('did_handle').execute()
  await db.schema.dropTable('did_cache').execute()
  await db.schema.dropTable('delete_account_token').execute()
  await db.schema.dropTable('blob').execute()
  await db.schema.dropTable('backlink').execute()
  await db.schema.dropTable('app_password').execute()
  await db.schema.dropTable('app_migration').execute()
}
