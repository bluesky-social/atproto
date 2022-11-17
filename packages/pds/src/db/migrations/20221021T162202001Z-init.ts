import { Kysely, sql } from 'kysely'
import { Dialect } from '..'

const userTable = 'user'
const didHandleTable = 'did_handle'
const sceneTable = 'scene'
const refreshTokenTable = 'refresh_token'
const repoRootTable = 'repo_root'
const recordTable = 'record'
const ipldBlockTable = 'ipld_block'
const ipldBlockCreatorTable = 'ipld_block_creator'
const inviteCodeTable = 'invite_code'
const inviteUseTable = 'invite_code_use'
const notificationTable = 'user_notification'
const assertionTable = 'assertion'
const profileTable = 'profile'
const confirmationTable = 'confirmation'
const followTable = 'follow'
const postTable = 'post'
const postEntityTable = 'post_entity'
const repostTable = 'repost'
const trendTable = 'trend'
const voteTable = 'vote'
const messageQueueTable = 'message_queue'
const messageQueueCursorTable = 'message_queue_cursor'
const sceneMemberCountTable = 'scene_member_count'
const sceneVotesOnPostTable = 'scene_votes_on_post'

export async function up(db: Kysely<unknown>, dialect: Dialect): Promise<void> {
  if (dialect === 'pg') {
    try {
      // Add trigram support, supporting user search.
      // Explicitly add to public schema, so the extension can be seen in all schemas.
      await sql`create extension if not exists pg_trgm with schema public`.execute(
        db,
      )
    } catch (err: any) {
      // The "if not exists" isn't bulletproof against races, and we see test suites racing to
      // create the extension. So we can just ignore errors indicating the extension already exists.
      if (!err?.detail?.includes?.('(pg_trgm) already exists')) throw err
    }
  }

  // Postgres uses the type `bytea` for variable length bytes
  const binaryDatatype = dialect === 'sqlite' ? 'blob' : sql`bytea`

  // Users
  await db.schema
    .createTable(userTable)
    .addColumn('handle', 'varchar', (col) => col.primaryKey())
    .addColumn('email', 'varchar', (col) => col.notNull().unique())
    .addColumn('password', 'varchar', (col) => col.notNull())
    .addColumn('lastSeenNotifs', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createIndex(`${userTable}_email_lower_idx`)
    .unique()
    .on(userTable)
    .expression(sql`lower("email")`)
    .execute()
  // Did Handle
  await db.schema
    .createTable(didHandleTable)
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('handle', 'varchar', (col) => col.unique())
    .addColumn('actorType', 'varchar')
    .addColumn('declarationCid', 'varchar')
    .execute()
  await db.schema
    .createIndex(`${didHandleTable}_handle_lower_idx`)
    .unique()
    .on(didHandleTable)
    .expression(sql`lower("handle")`)
    .execute()
  if (dialect === 'pg') {
    await db.schema // Supports user search
      .createIndex(`${didHandleTable}_handle_tgrm_idx`)
      .on(didHandleTable)
      .using('gist')
      .expression(sql`"handle" gist_trgm_ops`)
      .execute()
  }
  // Scenes
  await db.schema
    .createTable(sceneTable)
    .addColumn('handle', 'varchar', (col) => col.primaryKey())
    .addColumn('owner', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
  // Refresh Tokens
  await db.schema
    .createTable(refreshTokenTable)
    .addColumn('id', 'varchar', (col) => col.primaryKey())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('expiresAt', 'varchar', (col) => col.notNull())
    .execute()
  // Repo roots
  await db.schema
    .createTable(repoRootTable)
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('root', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  // Records
  await db.schema
    .createTable(recordTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('collection', 'varchar', (col) => col.notNull())
    .addColumn('rkey', 'varchar', (col) => col.notNull())
    .execute()
  // Ipld Blocks
  await db.schema
    .createTable(ipldBlockTable)
    .addColumn('cid', 'varchar', (col) => col.primaryKey())
    .addColumn('size', 'integer', (col) => col.notNull())
    .addColumn('content', binaryDatatype, (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  // Ipld Block Creators
  await db.schema
    .createTable(ipldBlockCreatorTable)
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addPrimaryKeyConstraint(`${ipldBlockCreatorTable}_pkey`, ['cid', 'did'])
    .execute()
  // Invite Codes
  await db.schema
    .createTable(inviteCodeTable)
    .addColumn('code', 'varchar', (col) => col.primaryKey())
    .addColumn('availableUses', 'integer', (col) => col.notNull())
    .addColumn('disabled', 'int2', (col) => col.defaultTo(0))
    .addColumn('forUser', 'varchar', (col) => col.notNull())
    .addColumn('createdBy', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(inviteUseTable)
    .addColumn('code', 'varchar', (col) => col.notNull())
    .addColumn('usedBy', 'varchar', (col) => col.notNull())
    .addColumn('usedAt', 'varchar', (col) => col.notNull())
    // Index names need to be unique per schema for postgres
    .addPrimaryKeyConstraint(`${inviteUseTable}_pkey`, ['code', 'usedBy'])
    .execute()
  // Notifications
  await db.schema
    .createTable(notificationTable)
    .addColumn('userDid', 'varchar', (col) => col.notNull())
    .addColumn('recordUri', 'varchar', (col) => col.notNull())
    .addColumn('recordCid', 'varchar', (col) => col.notNull())
    .addColumn('author', 'varchar', (col) => col.notNull())
    .addColumn('reason', 'varchar', (col) => col.notNull())
    .addColumn('reasonSubject', 'varchar')
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  // Assertions
  await db.schema
    .createTable(assertionTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('assertion', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectDeclarationCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addColumn('confirmUri', 'varchar')
    .addColumn('confirmCid', 'varchar')
    .addColumn('confirmCreated', 'varchar')
    .addColumn('confirmIndexed', 'varchar')
    .execute()
  // Profiles
  await db.schema
    .createTable(profileTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('displayName', 'varchar', (col) => col.notNull())
    .addColumn('description', 'varchar')
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  if (dialect === 'pg') {
    await db.schema // Supports user search
      .createIndex(`${profileTable}_display_name_tgrm_idx`)
      .on(profileTable)
      .using('gist')
      .expression(sql`"displayName" gist_trgm_ops`)
      .execute()
  }
  // Follows
  await db.schema
    .createTable(followTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectDeclarationCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  // Posts
  await db.schema
    .createTable(postTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('text', 'varchar', (col) => col.notNull())
    .addColumn('replyRoot', 'varchar')
    .addColumn('replyRootCid', 'varchar')
    .addColumn('replyParent', 'varchar')
    .addColumn('replyParentCid', 'varchar')
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(postEntityTable)
    .addColumn('postUri', 'varchar', (col) => col.notNull())
    .addColumn('startIndex', 'integer', (col) => col.notNull())
    .addColumn('endIndex', 'integer', (col) => col.notNull())
    .addColumn('type', 'varchar', (col) => col.notNull())
    .addColumn('value', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(repostTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(trendTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(voteTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('direction', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  let mqBuilder = db.schema.createTable(messageQueueTable)
  mqBuilder =
    dialect === 'pg'
      ? mqBuilder.addColumn('id', 'serial', (col) => col.primaryKey())
      : mqBuilder.addColumn('id', 'integer', (col) =>
          col.autoIncrement().primaryKey(),
        )
  mqBuilder
    .addColumn('message', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(messageQueueCursorTable)
    .addColumn('consumer', 'varchar', (col) => col.primaryKey())
    .addColumn('cursor', 'integer', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(sceneMemberCountTable)
    .addColumn('did', 'varchar', (col) => col.primaryKey())
    .addColumn('count', 'integer', (col) => col.notNull())
    .execute()
  await db.schema
    .createTable(sceneVotesOnPostTable)
    .addColumn('did', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('count', 'integer', (col) => col.notNull())
    .addColumn('postedTrending', 'int2', (col) => col.notNull())
    .addPrimaryKeyConstraint(`${sceneVotesOnPostTable}_pkey`, [
      'did',
      'subject',
    ])
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(sceneVotesOnPostTable).execute()
  await db.schema.dropTable(sceneMemberCountTable).execute()
  await db.schema.dropTable(messageQueueCursorTable).execute()
  await db.schema.dropTable(messageQueueTable).execute()
  await db.schema.dropTable(voteTable).execute()
  await db.schema.dropTable(trendTable).execute()
  await db.schema.dropTable(repostTable).execute()
  await db.schema.dropTable(postEntityTable).execute()
  await db.schema.dropTable(postTable).execute()
  await db.schema.dropTable(followTable).execute()
  await db.schema.dropTable(confirmationTable).execute()
  await db.schema.dropTable(assertionTable).execute()
  await db.schema.dropTable(profileTable).execute()
  await db.schema.dropTable(notificationTable).execute()
  await db.schema.dropTable(inviteUseTable).execute()
  await db.schema.dropTable(inviteCodeTable).execute()
  await db.schema.dropTable(ipldBlockCreatorTable).execute()
  await db.schema.dropTable(ipldBlockTable).execute()
  await db.schema.dropTable(recordTable).execute()
  await db.schema.dropTable(repoRootTable).execute()
  await db.schema.dropTable(didHandleTable).execute()
  await db.schema.dropTable(userTable).execute()
}
