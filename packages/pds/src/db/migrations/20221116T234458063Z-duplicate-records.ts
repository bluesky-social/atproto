import { Kysely } from 'kysely'
import DatabaseSchema from '../database-schema'
import { Assertion } from '../tables/assertion'
import { Follow } from '../tables/follow'
import { Repost } from '../tables/repost'
import { Trend } from '../tables/trend'
import { Vote } from '../tables/vote'

type DatabaseSchemaWithTemps = DatabaseSchema & {
  repost_temp: Repost
  trend_temp: Trend
  vote_temp: Vote
  follow_temp: Follow
  assertion_temp: Assertion
}

const duplicateRecordTable = 'duplicate_record'

export async function up(db: Kysely<DatabaseSchemaWithTemps>): Promise<void> {
  await db.schema
    .createTable(duplicateRecordTable)
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('duplicateOf', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .execute()

  const duplicateReposts = await db
    .selectFrom('repost')
    .selectAll()
    .orderBy('repost.indexedAt', 'asc')
    .limit(1)
    .innerJoin('repost as copy', 'copy.subject', 'repost.subject')
    .where('copy.creator', '=', 'repost.creator')
    .where('copy.uri', '!=', 'repost.uri')
    .execute()
  const repostUris = duplicateReposts.map((row) => row.uri)
  await db.schema
    .createTable('repost_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('repost_unique_subject', ['creator', 'subject'])
    .execute()
  await db
    .insertInto('repost_temp')
    .expression((exp) =>
      exp.selectFrom('repost').selectAll().where('uri', 'not in', repostUris),
    )
    .execute()
  await db.schema.dropTable('repost').execute()
  await db.schema.alterTable('repost_temp').renameTo('repost').execute()

  const duplicateTrends = await db
    .selectFrom('trend')
    .selectAll()
    .orderBy('trend.indexedAt', 'asc')
    .limit(1)
    .innerJoin('trend as copy', 'copy.subject', 'trend.subject')
    .where('copy.creator', '=', 'trend.creator')
    .where('copy.uri', '!=', 'trend.uri')
    .execute()
  const trendUris = duplicateTrends.map((row) => row.uri)
  await db.schema
    .createTable('trend_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('trend_unique_subject', ['creator', 'subject'])
    .execute()
  await db
    .insertInto('trend_temp')
    .expression((exp) =>
      exp.selectFrom('trend').selectAll().where('uri', 'not in', trendUris),
    )
    .execute()
  await db.schema.dropTable('trend').execute()
  await db.schema.alterTable('trend_temp').renameTo('trend').execute()

  const duplicateVotes = await db
    .selectFrom('vote')
    .selectAll()
    .orderBy('vote.indexedAt', 'asc')
    .limit(1)
    .innerJoin('vote as copy', 'copy.subject', 'vote.subject')
    .where('copy.creator', '=', 'vote.creator')
    .where('copy.uri', '!=', 'vote.uri')
    .execute()
  const voteUris = duplicateVotes.map((row) => row.uri)
  await db.schema
    .createTable('vote_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('direction', 'varchar', (col) => col.notNull())
    .addColumn('subject', 'varchar', (col) => col.notNull())
    .addColumn('subjectCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('vote_unique_subject', ['creator', 'subject'])
    .execute()
  await db
    .insertInto('vote_temp')
    .expression((exp) =>
      exp.selectFrom('vote').selectAll().where('uri', 'not in', voteUris),
    )
    .execute()
  await db.schema.dropTable('vote').execute()
  await db.schema.alterTable('vote_temp').renameTo('vote').execute()

  const duplicateFollows = await db
    .selectFrom('follow')
    .selectAll()
    .orderBy('follow.indexedAt', 'asc')
    .limit(1)
    .innerJoin('follow as copy', 'copy.subjectDid', 'follow.subjectDid')
    .where('copy.creator', '=', 'follow.creator')
    .where('copy.uri', '!=', 'follow.uri')
    .execute()
  const followUris = duplicateFollows.map((row) => row.uri)
  await db.schema
    .createTable('follow_temp')
    .addColumn('uri', 'varchar', (col) => col.primaryKey())
    .addColumn('cid', 'varchar', (col) => col.notNull())
    .addColumn('creator', 'varchar', (col) => col.notNull())
    .addColumn('subjectDid', 'varchar', (col) => col.notNull())
    .addColumn('subjectDeclarationCid', 'varchar', (col) => col.notNull())
    .addColumn('createdAt', 'varchar', (col) => col.notNull())
    .addColumn('indexedAt', 'varchar', (col) => col.notNull())
    .addUniqueConstraint('follow_unique_subject', ['creator', 'subjectDid'])
    .execute()
  await db
    .insertInto('follow_temp')
    .expression((exp) =>
      exp.selectFrom('follow').selectAll().where('uri', 'not in', followUris),
    )
    .execute()
  await db.schema.dropTable('follow').execute()
  await db.schema.alterTable('follow_temp').renameTo('follow').execute()

  const duplicateAssertions = await db
    .selectFrom('assertion')
    .selectAll()
    .orderBy('assertion.indexedAt', 'asc')
    .limit(1)
    .innerJoin('assertion as copy', 'copy.subjectDid', 'assertion.subjectDid')
    .where('copy.creator', '=', 'assertion.creator')
    .where('copy.assertion', '=', 'assertion.assertion')
    .where('copy.uri', '!=', 'assertion.uri')
    .execute()
  const assertionUris = duplicateAssertions.map((row) => row.uri)
  await db.schema
    .createTable('assertion_temp')
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
    .addUniqueConstraint('assertion_unique_subject', [
      'creator',
      'subjectDid',
      'assertion',
    ])
    .execute()
  await db
    .insertInto('assertion_temp')
    .expression((exp) =>
      exp
        .selectFrom('assertion')
        .selectAll()
        .where('uri', 'not in', assertionUris),
    )
    .execute()
  await db.schema.dropTable('assertion').execute()
  await db.schema.alterTable('assertion_temp').renameTo('assertion').execute()
}

export async function down(db: Kysely<DatabaseSchema>): Promise<void> {
  await db.schema.dropTable(duplicateRecordTable)
}
